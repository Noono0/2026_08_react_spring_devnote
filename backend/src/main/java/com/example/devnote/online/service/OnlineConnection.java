package com.example.devnote.online.service;

import lombok.Getter;

/**
 * WebSocket 연결 하나에 대한 정보. 연결될 때 OnlineGameWebSocketHandler가 만들고, 요청마다 Service에 넘긴다.
 *
 *   memberId·memberName : 연결할 때 로그인 세션으로 확인한 회원(비회원이면 null). 화면이 보낸 값은 믿지 않는다.
 *   passwordFailures    : 방 비밀번호를 틀린 횟수. 5번 틀리면 연결을 끊는다(무작위 대입 막기)
 *   메시지 횟수          : 1초에 20개까지(게임·채팅·PING 모두 포함). 넘으면 거절
 */
@Getter
public class OnlineConnection {
    public static final int MAX_PASSWORD_FAILURES = 5;
    public static final int MAX_MESSAGES_PER_SECOND = 20;

    private final String sessionId;
    private final Long memberId;
    private final String memberName;
    private int passwordFailures;
    private long messageWindowStart;
    private int messagesInWindow;

    public OnlineConnection(String sessionId, Long memberId, String memberName) {
        this.sessionId = sessionId;
        this.memberId = memberId;
        this.memberName = memberName;
    }

    public boolean isMember() {
        return memberId != null;
    }

    public void recordPasswordFailure() {
        passwordFailures++;
    }

    public boolean isPasswordLocked() {
        return passwordFailures >= MAX_PASSWORD_FAILURES;
    }

    /** 메시지 하나를 받아도 되는지(1초 창 안에서 20개까지). 같은 연결의 메시지는 차례로 처리되므로 잠금이 필요 없다 */
    public boolean tryAcceptMessage(long nowMillis) {
        if (nowMillis - messageWindowStart >= 1_000) {
            messageWindowStart = nowMillis;
            messagesInWindow = 0;
        }
        messagesInWindow++;
        return messagesInWindow <= MAX_MESSAGES_PER_SECOND;
    }
}
