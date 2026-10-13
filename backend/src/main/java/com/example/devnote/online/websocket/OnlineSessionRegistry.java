package com.example.devnote.online.websocket;

import com.example.devnote.online.dto.OnlineServerMessage;
import com.example.devnote.online.service.OnlineMessageSender;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 지금 연결된 WebSocket들을 기억하고 메시지를 보내는 곳(OnlineMessageSender의 실제 구현).
 *
 * [ConcurrentWebSocketSessionDecorator]
 *   WebSocketSession.sendMessage는 동시에 두 스레드가 부르면 오류가 난다.
 *   (예: A가 돌을 둬서 보내는 중에 B의 채팅도 같은 사람에게 보내야 할 때)
 *   이 감싸개는 보낼 메시지를 줄 세워 하나씩 보내 준다. 너무 느린 연결(5초·64KB 초과)은 끊는다.
 *
 * [오래 조용한 연결 정리]
 *   화면은 25초마다 PING을 보낸다. 90초 동안 아무 메시지도 없으면 끊긴 연결로 보고 닫는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OnlineSessionRegistry implements OnlineMessageSender {
    static final int SEND_TIME_LIMIT_MILLIS = 5_000;
    static final int BUFFER_SIZE_LIMIT_BYTES = 64 * 1024;
    static final long IDLE_TIMEOUT_MILLIS = 90_000;

    private record Entry(WebSocketSession session, long[] lastSeen) {}

    private final ObjectMapper objectMapper;
    private final Map<String, Entry> sessions = new ConcurrentHashMap<>();

    void register(WebSocketSession session) {
        WebSocketSession decorated = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MILLIS, BUFFER_SIZE_LIMIT_BYTES);
        sessions.put(session.getId(), new Entry(decorated, new long[] {System.currentTimeMillis()}));
    }

    void unregister(String sessionId) {
        sessions.remove(sessionId);
    }

    void touch(String sessionId) {
        Entry entry = sessions.get(sessionId);
        if (entry != null) entry.lastSeen()[0] = System.currentTimeMillis();
    }

    @Override
    public void send(String sessionId, OnlineServerMessage message) {
        Entry entry = sessions.get(sessionId);
        if (entry == null || !entry.session().isOpen()) return; // 방금 끊긴 연결: 곧 afterConnectionClosed가 정리한다
        try {
            entry.session().sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
        } catch (JsonProcessingException exception) {
            log.error("[Online] 메시지를 JSON으로 바꾸지 못했습니다. type={}", message.type(), exception);
        } catch (IOException | IllegalStateException exception) {
            // 상대 네트워크가 끊겼거나 너무 느린 경우. 연결을 닫으면 afterConnectionClosed에서 방을 정리한다.
            log.warn("[Online] 메시지를 보내지 못해 연결을 닫습니다. sessionId={}, reason={}", sessionId, exception.getMessage());
            closeQuietly(entry.session(), CloseStatus.SESSION_NOT_RELIABLE);
        }
    }

    @Override
    public void close(String sessionId, String reason) {
        Entry entry = sessions.get(sessionId);
        if (entry != null) closeQuietly(entry.session(), CloseStatus.POLICY_VIOLATION.withReason(reason));
    }

    @Scheduled(fixedDelay = 30_000)
    public void closeIdleSessions() {
        long now = System.currentTimeMillis();
        sessions.forEach((sessionId, entry) -> {
            if (now - entry.lastSeen()[0] > IDLE_TIMEOUT_MILLIS) {
                log.info("[Online] 오래 응답이 없는 연결을 닫습니다. sessionId={}", sessionId);
                closeQuietly(entry.session(), CloseStatus.SESSION_NOT_RELIABLE);
            }
        });
    }

    private static void closeQuietly(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) session.close(status);
        } catch (IOException exception) {
            log.warn("[Online] 연결을 닫는 중 오류가 났습니다. sessionId={}", session.getId(), exception);
        }
    }
}
