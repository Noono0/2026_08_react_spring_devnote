package com.example.devnote.online.config;

import com.example.devnote.online.websocket.OnlineGameWebSocketHandler;
import com.example.devnote.online.websocket.OnlineHandshakeInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * 온라인 대전 WebSocket 주소를 등록한다.
 *
 * [주소를 /api 아래에 둔 이유]
 *   개발 서버(Vite)와 운영 Nginx가 /api로 시작하는 요청을 백엔드로 전달하므로, 화면은 같은 주소(origin)로 연결한다.
 *   (WebSocket 전달 설정: frontend/vite.config.ts의 ws: true, frontend/nginx.conf의 /api/v1/online/ws 블록)
 *
 * [setAllowedOrigins]
 *   다른 사이트의 페이지가 사용자의 로그인 쿠키로 몰래 연결하는 것(Cross-Site WebSocket Hijacking)을 막는다.
 *   같은 주소에서 온 연결은 항상 허락되고, 여기 적은 개발용 주소(Vite가 changeOrigin으로 전달할 때)만 추가로 허락한다.
 *   SecurityConfiguration의 CORS 허용 목록과 같은 값이다.
 */
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class OnlineWebSocketConfiguration implements WebSocketConfigurer {
    public static final String ENDPOINT = "/api/v1/online/ws";

    private final OnlineGameWebSocketHandler handler;
    private final OnlineHandshakeInterceptor handshakeInterceptor;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, ENDPOINT)
            .addInterceptors(handshakeInterceptor)
            .setAllowedOrigins("http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000");
    }
}
