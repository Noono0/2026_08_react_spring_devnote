package com.example.devnote.online.domain;

import lombok.Getter;

import java.util.ArrayDeque;
import java.util.Deque;

/**
 * 방에 들어온 한 사람(WebSocket 연결 하나). 플레이어인지 관전자인지는 OnlineRoom의 자리(seats)가 정한다.
 *
 *   participantId : 화면에 보내는 무작위 번호(WebSocket 연결 번호 sessionId는 밖에 보내지 않는다)
 *   memberId      : 로그인 회원이면 회원 번호, 비회원이면 null
 */
@Getter
public class OnlineParticipant {
    /** 채팅 도배 막기: 1초 안에 2개까지 */
    public static final int CHAT_LIMIT_PER_WINDOW = 2;
    public static final long CHAT_WINDOW_MILLIS = 1_000;

    private final String participantId;
    private final String sessionId;
    private final String nickname;
    private final Long memberId;
    /** 최근에 채팅을 보낸 시각들(밀리초). 오래된 것은 꺼내 버린다. */
    private final Deque<Long> recentChatTimes = new ArrayDeque<>();

    public OnlineParticipant(String participantId, String sessionId, String nickname, Long memberId) {
        this.participantId = participantId;
        this.sessionId = sessionId;
        this.nickname = nickname;
        this.memberId = memberId;
    }

    public boolean isMember() {
        return memberId != null;
    }

    /** 지금(nowMillis) 채팅을 보내도 되는지 확인하고, 되면 기록한다 */
    public boolean tryRecordChat(long nowMillis) {
        while (!recentChatTimes.isEmpty() && nowMillis - recentChatTimes.peekFirst() >= CHAT_WINDOW_MILLIS) {
            recentChatTimes.pollFirst();
        }
        if (recentChatTimes.size() >= CHAT_LIMIT_PER_WINDOW) return false;
        recentChatTimes.addLast(nowMillis);
        return true;
    }
}
