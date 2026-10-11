package com.example.devnote.online.websocket;

import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * WebSocket 연결이 시작되는 순간(handshake)에 "이 사람이 로그인 회원인가"를 확인한다.
 *
 * WebSocket도 처음에는 평범한 HTTP 요청으로 시작하므로 브라우저가 로그인 세션 쿠키를 함께 보낸다.
 * 그 쿠키로 다른 API와 같은 방법(AuthenticationService)으로 회원을 찾고, 연결 속성(attributes)에 넣어 둔다.
 * 연결 뒤에 화면이 "나는 회원 3번이야"라고 보내는 값은 믿지 않는다.
 *
 * ★ 로그인하지 않았어도 연결은 허락한다(비회원 참가). "로그인 유저만" 방인지는 입장할 때 Service가 확인한다.
 */
@Component
@RequiredArgsConstructor
public class OnlineHandshakeInterceptor implements HandshakeInterceptor {
    static final String MEMBER_ID = "onlineMemberId";
    static final String MEMBER_NAME = "onlineMemberName";

    private final AuthenticationService authenticationService;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler, Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            MemberRow member = authenticationService.findAuthenticatedMember(servletRequest.getServletRequest());
            if (member != null) {
                attributes.put(MEMBER_ID, member.getMemberId());
                attributes.put(MEMBER_NAME, member.getMemberName());
            }
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler, Exception exception) {
        // 연결 뒤에 따로 할 일은 없다.
    }
}
