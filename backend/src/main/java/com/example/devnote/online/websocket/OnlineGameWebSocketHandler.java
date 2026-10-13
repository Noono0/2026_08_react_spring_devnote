package com.example.devnote.online.websocket;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.online.dto.OnlineClientMessage;
import com.example.devnote.online.dto.OnlineServerMessage;
import com.example.devnote.online.service.OnlineConnection;
import com.example.devnote.online.service.OnlineRoomService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * 온라인 대전 WebSocket 입구(REST의 Controller 역할). 경로: /api/v1/online/ws
 *
 * [한 연결의 일생]
 *   1. afterConnectionEstablished : 연결을 기억하고(OnlineSessionRegistry) 연결 정보(회원 여부)를 만든다
 *   2. handleTextMessage          : 화면이 보낸 JSON을 읽어 type에 맞는 Service 메서드를 부른다
 *   3. afterConnectionClosed      : 탭을 닫거나 네트워크가 끊기면 방에서 내보낸다
 *
 * 업무 규칙 위반(BusinessException)은 연결을 끊지 않고 ERROR 메시지로 보낸 사람에게만 알린다.
 * 예상하지 못한 오류는 내부 내용을 숨기고 일반 문구만 보낸다(로그에는 자세히 남긴다).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OnlineGameWebSocketHandler extends TextWebSocketHandler {
    /** 화면이 보내는 메시지는 짧다(채팅 200자 + 여유). 이보다 크면 받지 않는다 */
    static final int MAX_TEXT_MESSAGE_BYTES = 8 * 1024;
    private static final String CONNECTION = "onlineConnection";

    private final OnlineRoomService roomService;
    private final OnlineSessionRegistry sessionRegistry;
    private final ObjectMapper objectMapper;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        session.setTextMessageSizeLimit(MAX_TEXT_MESSAGE_BYTES);
        Object memberId = session.getAttributes().get(OnlineHandshakeInterceptor.MEMBER_ID);
        Object memberName = session.getAttributes().get(OnlineHandshakeInterceptor.MEMBER_NAME);
        OnlineConnection connection = new OnlineConnection(
            session.getId(),
            memberId instanceof Long id ? id : null,
            memberName instanceof String name ? name : null
        );
        session.getAttributes().put(CONNECTION, connection);
        sessionRegistry.register(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage textMessage) {
        if (!(session.getAttributes().get(CONNECTION) instanceof OnlineConnection connection)) return;
        sessionRegistry.touch(session.getId());
        String type = null;
        try {
            if (!connection.tryAcceptMessage(System.currentTimeMillis())) throw new BusinessException(ErrorCode.ONLINE_TOO_MANY_MESSAGES);
            OnlineClientMessage message = objectMapper.readValue(textMessage.getPayload(), OnlineClientMessage.class);
            type = message.type();
            dispatch(connection, message);
        } catch (BusinessException exception) {
            sessionRegistry.send(session.getId(), OnlineServerMessage.error(exception.getErrorCode().getCode(), exception.getMessage()));
            if (connection.isPasswordLocked()) sessionRegistry.close(session.getId(), "비밀번호를 여러 번 틀렸습니다.");
        } catch (JsonProcessingException exception) {
            // 알 수 없는 게임 종류(enum)나 깨진 JSON
            sendError(session, ErrorCode.ONLINE_MESSAGE_INVALID);
        } catch (RuntimeException exception) {
            log.error("[Online] 메시지 처리 중 예상하지 못한 오류. sessionId={}, type={}", session.getId(), type, exception);
            sendError(session, ErrorCode.COMMON_INTERNAL_SERVER_ERROR);
        }
    }

    private void dispatch(OnlineConnection connection, OnlineClientMessage message) {
        String type = message.type() == null ? "" : message.type();
        switch (type) {
            case "PING" -> sessionRegistry.send(connection.getSessionId(), OnlineServerMessage.pong());
            case "JOIN" -> roomService.join(connection, message);
            case "SIT" -> roomService.sit(connection, message.seatIndex());
            case "STAND" -> roomService.stand(connection);
            case "UPDATE_ROOM" -> roomService.updateSettings(connection, message.settings());
            case "START" -> roomService.start(connection);
            case "OMOK_PLACE" -> roomService.placeOmok(connection, message.row(), message.col());
            case "RESIGN" -> roomService.resign(connection);
            case "CHAT" -> roomService.chat(connection, message.text());
            case "TETRIS_BOARD" -> roomService.updateTetrisBoard(connection, message.board(), message.score(), message.lines());
            case "TETRIS_ATTACK" -> roomService.tetrisAttack(connection, message.cleared());
            case "TETRIS_TOPPED_OUT" -> roomService.tetrisToppedOut(connection);
            default -> throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        try {
            roomService.leave(session.getId());
        } finally {
            sessionRegistry.unregister(session.getId());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("[Online] 연결 오류. sessionId={}, reason={}", session.getId(), exception.getMessage());
    }

    private void sendError(WebSocketSession session, ErrorCode errorCode) {
        sessionRegistry.send(session.getId(), OnlineServerMessage.error(errorCode.getCode(), errorCode.getDefaultMessage()));
    }
}
