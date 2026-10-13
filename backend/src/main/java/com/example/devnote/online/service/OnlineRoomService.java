package com.example.devnote.online.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.service.AuthenticationService;
import com.example.devnote.online.domain.OnlineChatMessage;
import com.example.devnote.online.domain.OnlineGameType;
import com.example.devnote.online.domain.OnlineMatchResult;
import com.example.devnote.online.domain.OnlineParticipant;
import com.example.devnote.online.domain.OnlineRoom;
import com.example.devnote.online.domain.OnlineRoomSettings;
import com.example.devnote.online.domain.TetrisBattle;
import com.example.devnote.online.domain.game.GameAction;
import com.example.devnote.online.dto.OnlineChatView;
import com.example.devnote.online.dto.OnlineClientMessage;
import com.example.devnote.online.dto.OnlineGameTypeResponse;
import com.example.devnote.online.dto.OnlineRoomCreateRequest;
import com.example.devnote.online.dto.OnlineRoomCreatedResponse;
import com.example.devnote.online.dto.OnlineRoomSettingsMessage;
import com.example.devnote.online.dto.OnlineRoomSummaryResponse;
import com.example.devnote.online.dto.OnlineServerMessage;
import com.example.devnote.online.store.OnlineRoomStore;
import com.example.devnote.ranking.service.GameRankingService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import java.util.function.BiConsumer;

/**
 * 온라인 대전 업무 규칙의 입구. (Controller·WebSocket Handler → 이 Service → OnlineRoom(규칙) / OnlineRoomStore(보관))
 *
 * [동시에 여러 사람이 같은 방을 건드리면?]
 *   두 사람이 같은 순간에 같은 자리에 앉으려 하면, 둘 다 "비어 있네"라고 보고 둘 다 앉을 수 있다.
 *   그래서 방을 바꾸는 모든 일은 synchronized (room) 안에서 한다. 한 방은 한 번에 한 요청만 바꾸고,
 *   다른 방끼리는 서로 기다리지 않는다(방마다 잠금이 따로라 서버 전체가 느려지지 않는다).
 *
 * [바뀐 뒤에는 방 사람 모두에게 알린다]
 *   상태가 바뀌면 broadcast가 방 사람마다 ROOM_STATE(각자 "나"만 다름)와 새 채팅을 보낸다.
 *   잠금 안에서 보내므로 모든 사람이 같은 순서로 상태를 받는다.
 *
 * [게임이 끝나면 랭킹에 저장]
 *   방이 남긴 결과(drainFinishedMatch)를 잠금 안에서 꺼내고, DB 저장은 잠금을 푼 뒤에 한다.
 *   DB가 느려도 같은 방의 다른 요청이 기다리지 않게 하기 위해서다.
 */
@Slf4j
@Service
public class OnlineRoomService {
    public static final int NICKNAME_MIN_LENGTH = 2;
    public static final int NICKNAME_MAX_LENGTH = 12;
    private static final char[] ID_CHARACTERS = "abcdefghijkmnpqrstuvwxyz23456789".toCharArray();

    private final OnlineRoomStore roomStore;
    private final OnlineMessageSender messageSender;
    private final AuthenticationService authenticationService;
    private final GameRankingService gameRankingService;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public OnlineRoomService(OnlineRoomStore roomStore, OnlineMessageSender messageSender, AuthenticationService authenticationService,
                             GameRankingService gameRankingService) {
        this(roomStore, messageSender, authenticationService, gameRankingService, Clock.systemUTC());
    }

    /** 테스트에서 시간을 고정할 때 쓰는 생성자 */
    OnlineRoomService(OnlineRoomStore roomStore, OnlineMessageSender messageSender, AuthenticationService authenticationService,
                      GameRankingService gameRankingService, Clock clock) {
        this.roomStore = roomStore;
        this.messageSender = messageSender;
        this.authenticationService = authenticationService;
        this.gameRankingService = gameRankingService;
        this.clock = clock;
    }

    // ── REST: 대기실 ─────────────────────────────────────────────────

    public List<OnlineGameTypeResponse> getGameTypes() {
        return Arrays.stream(OnlineGameType.values())
            .map(type -> new OnlineGameTypeResponse(type.name(), type.getLabel(), type.getMinSeats(), type.getMaxSeats(), type.isAvailable(),
                type.getOptions(), type.getDefaultOption()))
            .toList();
    }

    public List<OnlineRoomSummaryResponse> getRooms() {
        roomStore.removeExpiredEmptyRooms(now());
        return roomStore.findAll().stream()
            .map(room -> {
                synchronized (room) {
                    return OnlineRoomViewMapper.toSummary(room);
                }
            })
            .toList();
    }

    /** 방 만들기. 만든 사람은 돌려받은 hostToken으로 들어가 방장이 된다 */
    public OnlineRoomCreatedResponse createRoom(OnlineRoomCreateRequest request, HttpServletRequest servletRequest) {
        if (request.membersOnly() && authenticationService.findAuthenticatedMember(servletRequest) == null) {
            throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED, "'로그인 유저만 참가' 방은 로그인한 뒤 만들 수 있습니다.");
        }
        long now = now();
        roomStore.removeExpiredEmptyRooms(now);
        String hostToken = randomText(24);
        OnlineRoomSettings settings = new OnlineRoomSettings(
            request.title(), request.gameType(), request.seatCount(), request.password(), false, request.membersOnly(), request.gameOption());
        OnlineRoom room = new OnlineRoom(newRoomId(), settings, hostToken, now);
        roomStore.save(room);
        return new OnlineRoomCreatedResponse(room.getRoomId(), hostToken);
    }

    // ── WebSocket: 방 안 ─────────────────────────────────────────────

    /** 방에 들어간다. 로그인 유저만·비밀번호·닉네임을 확인한 뒤, 지난 대화를 보내고 모두에게 새 상태를 알린다 */
    public void join(OnlineConnection connection, OnlineClientMessage message) {
        if (roomStore.findMembership(connection.getSessionId()).isPresent()) {
            throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID, "이미 방에 들어와 있습니다.");
        }
        OnlineRoom room = roomStore.findById(message.roomId()).orElseThrow(() -> new BusinessException(ErrorCode.ONLINE_ROOM_NOT_FOUND));
        synchronized (room) {
            // 잠금을 기다리는 동안 빈 방 정리로 지워졌을 수 있다
            if (roomStore.findById(room.getRoomId()).orElse(null) != room) throw new BusinessException(ErrorCode.ONLINE_ROOM_NOT_FOUND);
            if (room.isMembersOnly() && !connection.isMember()) throw new BusinessException(ErrorCode.ONLINE_ROOM_MEMBERS_ONLY);
            boolean creator = room.hostTokenMatches(message.hostToken());
            if (!creator && room.hasPassword()) {
                if (message.password() == null || message.password().isEmpty()) throw new BusinessException(ErrorCode.ONLINE_ROOM_PASSWORD_REQUIRED);
                if (!room.passwordMatches(message.password())) {
                    connection.recordPasswordFailure();
                    throw new BusinessException(ErrorCode.ONLINE_ROOM_PASSWORD_INVALID);
                }
            }
            String nickname = resolveNickname(connection, message.nickname());
            if (room.isNicknameTaken(nickname)) throw new BusinessException(ErrorCode.ONLINE_NICKNAME_TAKEN);

            List<OnlineChatMessage> history = room.getChatHistory(); // 들어오기 전까지의 대화
            OnlineParticipant participant = new OnlineParticipant(randomText(12), connection.getSessionId(), nickname, connection.getMemberId());
            room.addParticipant(participant, creator, now());
            roomStore.bindSession(connection.getSessionId(), new OnlineRoomStore.Membership(room.getRoomId(), participant.getParticipantId()));
            if (!history.isEmpty()) messageSender.send(connection.getSessionId(), OnlineServerMessage.chats(OnlineRoomViewMapper.toChatViews(history)));
            broadcast(room, true);
        }
    }

    /** 연결이 끊기거나 나가기를 누르면: 자리를 비우고(게임 중이면 상대 승리) 방장을 넘긴다 */
    public void leave(String sessionId) {
        roomStore.unbindSession(sessionId).ifPresent(membership -> roomStore.findById(membership.roomId()).ifPresent(room -> {
            OnlineMatchResult finishedMatch;
            synchronized (room) {
                room.removeParticipant(membership.participantId(), now());
                broadcast(room, true);
                finishedMatch = room.drainFinishedMatch();
            }
            saveFinishedMatch(finishedMatch);
        }));
    }

    public void sit(OnlineConnection connection, Integer seatIndex) {
        int requestedSeat = requireValue(seatIndex);
        withRoom(connection, true, (room, participantId) -> room.sit(participantId, requestedSeat));
    }

    public void stand(OnlineConnection connection) {
        withRoom(connection, true, OnlineRoom::stand);
    }

    public void updateSettings(OnlineConnection connection, OnlineRoomSettingsMessage settings) {
        if (settings == null) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        withRoom(connection, true, (room, participantId) -> room.updateSettings(participantId, new OnlineRoomSettings(
            settings.title(),
            settings.gameType() == null ? room.getGameType() : settings.gameType(),
            settings.seatCount() == null ? room.getSeatCount() : settings.seatCount(),
            settings.newPassword(),
            settings.removePassword(),
            settings.membersOnly(),
            settings.gameOption()
        ), now()));
    }

    public void start(OnlineConnection connection) {
        // 테트리스 대전은 모두가 같은 시드로 같은 순서의 블록을 받는다(브라우저 tetrisLogic의 createTetrisState(seed))
        int seed = secureRandom.nextInt(Integer.MAX_VALUE);
        withRoom(connection, true, (room, participantId) -> room.start(participantId, now(), seed));
    }

    /** 테트리스 대전: 블록이 굳을 때마다 내 판 요약을 받아 모두에게 알린다(상대·관전자 화면의 작은 판) */
    public void updateTetrisBoard(OnlineConnection connection, String board, Integer score, Integer lines) {
        int nextScore = requireValue(score);
        int nextLines = requireValue(lines);
        withRoom(connection, true, (room, participantId) -> room.updateTetrisBoard(participantId, board, nextScore, nextLines));
    }

    /**
     * 테트리스 대전: 줄을 지웠다는 알림. 방해 줄은 받는 사람에게만 보내고(TETRIS_GARBAGE), 방 상태는 바뀌지 않으므로 모두에게 보내지 않는다.
     * 구멍 위치는 서버가 정한다 → 브라우저의 리듀서는 Math.random 없이 순수하게 줄을 넣는다.
     */
    public void tetrisAttack(OnlineConnection connection, Integer cleared) {
        int clearedLines = requireValue(cleared);
        OnlineRoomStore.Membership membership = requireMembership(connection);
        OnlineRoom room = requireRoom(membership);
        synchronized (room) {
            OnlineRoom.TetrisAttack attack = room.tetrisAttack(membership.participantId(), clearedLines);
            if (attack == null) return;
            String fromNickname = room.requireParticipant(membership.participantId()).getNickname();
            OnlineParticipant target = room.requireParticipant(attack.targetParticipantId());
            int holeCol = secureRandom.nextInt(TetrisBattle.BOARD_COLS);
            messageSender.send(target.getSessionId(), OnlineServerMessage.garbage(attack.lines(), holeCol, fromNickname));
        }
    }

    /** 공통 틀 게임(숫자 야구 등)의 행동. 규칙 판단은 게임 클래스가, 결과는 모두에게 ROOM_STATE로 */
    public void gameAction(OnlineConnection connection, GameAction action) {
        withRoom(connection, true, (room, participantId) -> room.gameAction(participantId, action, now()));
    }

    public void tetrisToppedOut(OnlineConnection connection) {
        withRoom(connection, true, (room, participantId) -> room.tetrisToppedOut(participantId, now()));
    }

    public void updatePuyoBoard(OnlineConnection connection, String board, Integer score, Integer lines) {
        int nextScore = requireValue(score);
        int nextChains = requireValue(lines);
        withRoom(connection, true, (room, participantId) -> room.updatePuyoBoard(participantId, board, nextScore, nextChains));
    }

    /**
     * 뿌요뿌요 대전: 방해 뿌요 개수 알림. 받는 사람에게만 PUYO_GARBAGE를 보내고, 방 상태는 바뀌지 않으므로 모두에게 보내지 않는다.
     */
    public void puyoAttack(OnlineConnection connection, Integer cleared) {
        int nuisance = requireValue(cleared);
        OnlineRoomStore.Membership membership = requireMembership(connection);
        OnlineRoom room = requireRoom(membership);
        synchronized (room) {
            OnlineRoom.PuyoAttack attack = room.puyoAttack(membership.participantId(), nuisance);
            if (attack == null) return;
            String fromNickname = room.requireParticipant(membership.participantId()).getNickname();
            OnlineParticipant target = room.requireParticipant(attack.targetParticipantId());
            messageSender.send(target.getSessionId(), OnlineServerMessage.puyoGarbage(attack.nuisance(), fromNickname));
        }
    }

    public void puyoToppedOut(OnlineConnection connection) {
        withRoom(connection, true, (room, participantId) -> room.puyoToppedOut(participantId, now()));
    }

    public void placeOmok(OnlineConnection connection, Integer row, Integer col) {
        int targetRow = requireValue(row);
        int targetCol = requireValue(col);
        withRoom(connection, true, (room, participantId) -> room.placeOmok(participantId, targetRow, targetCol, now()));
    }

    public void resign(OnlineConnection connection) {
        withRoom(connection, true, (room, participantId) -> room.resign(participantId, now()));
    }

    /** 채팅은 방 상태가 바뀌지 않으므로 새 채팅만 보낸다(ROOM_STATE 생략) */
    public void chat(OnlineConnection connection, String text) {
        withRoom(connection, false, (room, participantId) -> room.addChat(participantId, text, now()));
    }

    /** 1분마다 사람 없는 방을 정리한다(DevNoteApplication의 @EnableScheduling) */
    @Scheduled(fixedDelay = 60_000)
    public void removeExpiredRooms() {
        roomStore.removeExpiredEmptyRooms(now());
    }

    // ── 도우미 ──────────────────────────────────────────────────────

    /** 내가 들어가 있는 방을 잠근 채 action을 하고, 바뀐 내용을 방 사람 모두에게 알린다 */
    private void withRoom(OnlineConnection connection, boolean sendRoomState, BiConsumer<OnlineRoom, String> action) {
        OnlineRoomStore.Membership membership = requireMembership(connection);
        OnlineRoom room = requireRoom(membership);
        OnlineMatchResult finishedMatch;
        synchronized (room) {
            action.accept(room, membership.participantId());
            broadcast(room, sendRoomState);
            finishedMatch = room.drainFinishedMatch();
        }
        saveFinishedMatch(finishedMatch);
    }

    /** 끝난 판을 랭킹에 저장한다. DB 오류 때문에 게임 진행까지 멈추면 안 되므로 실패는 오류 로그로 남기고 넘어간다 */
    private void saveFinishedMatch(OnlineMatchResult finishedMatch) {
        if (finishedMatch == null) return;
        try {
            gameRankingService.recordOnlineMatch(finishedMatch);
        } catch (DataAccessException exception) {
            log.error("온라인 대전 결과를 랭킹에 저장하지 못했습니다 gameType={}", finishedMatch.gameType(), exception);
        }
    }

    private OnlineRoomStore.Membership requireMembership(OnlineConnection connection) {
        return roomStore.findMembership(connection.getSessionId()).orElseThrow(() -> new BusinessException(ErrorCode.ONLINE_ROOM_NOT_JOINED));
    }

    private OnlineRoom requireRoom(OnlineRoomStore.Membership membership) {
        return roomStore.findById(membership.roomId()).orElseThrow(() -> new BusinessException(ErrorCode.ONLINE_ROOM_NOT_FOUND));
    }

    private void broadcast(OnlineRoom room, boolean sendRoomState) {
        List<OnlineChatView> newChats = OnlineRoomViewMapper.toChatViews(room.drainPendingChats());
        for (OnlineParticipant participant : room.getParticipants()) {
            if (sendRoomState) {
                messageSender.send(participant.getSessionId(), OnlineServerMessage.roomState(OnlineRoomViewMapper.toView(room, participant.getParticipantId())));
            }
            if (!newChats.isEmpty()) messageSender.send(participant.getSessionId(), OnlineServerMessage.chats(newChats));
        }
    }

    /**
     * 회원은 회원 이름을 쓰고(화면이 보낸 닉네임은 무시), 비회원은 보낸 닉네임을 검사해 쓴다.
     * 제어 문자(줄바꿈 등)는 화면을 깨뜨릴 수 있어 받지 않는다.
     */
    private static String resolveNickname(OnlineConnection connection, String requestedNickname) {
        if (connection.isMember()) {
            String memberName = connection.getMemberName().strip();
            return memberName.length() > NICKNAME_MAX_LENGTH ? memberName.substring(0, NICKNAME_MAX_LENGTH) : memberName;
        }
        String nickname = requestedNickname == null ? "" : requestedNickname.strip();
        boolean hasControl = nickname.chars().anyMatch(Character::isISOControl);
        if (hasControl || nickname.length() < NICKNAME_MIN_LENGTH || nickname.length() > NICKNAME_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.ONLINE_NICKNAME_INVALID);
        }
        return nickname;
    }

    private static int requireValue(Integer value) {
        if (value == null) throw new BusinessException(ErrorCode.ONLINE_MESSAGE_INVALID);
        return value;
    }

    /** 겹치지 않는 8글자 방 번호(헷갈리는 l·o·0·1은 뺐다) */
    private String newRoomId() {
        String roomId;
        do {
            roomId = randomText(8);
        } while (roomStore.findById(roomId).isPresent());
        return roomId;
    }

    private String randomText(int length) {
        char[] characters = new char[length];
        for (int index = 0; index < length; index++) characters[index] = ID_CHARACTERS[secureRandom.nextInt(ID_CHARACTERS.length)];
        return new String(characters);
    }

    private long now() {
        return clock.millis();
    }
}
