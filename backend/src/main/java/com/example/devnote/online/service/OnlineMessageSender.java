package com.example.devnote.online.service;

import com.example.devnote.online.dto.OnlineServerMessage;

/**
 * Service가 "이 연결에 이 메시지를 보내 줘"라고 부탁하는 창구.
 *
 * Service가 WebSocket 클래스를 직접 알지 않게 인터페이스로 나눴다.
 *   - 실제 앱: OnlineSessionRegistry(WebSocket으로 보냄)
 *   - 테스트: 보낸 메시지를 목록에 모아 두는 가짜 구현
 */
public interface OnlineMessageSender {
    void send(String sessionId, OnlineServerMessage message);

    /** 연결을 끊는다(비밀번호를 너무 많이 틀렸을 때 등). reason은 사용자에게 보여도 되는 문구 */
    void close(String sessionId, String reason);
}
