package com.example.devnote.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 로그인 요청 본문. { "loginId": "admin", "password": "...", "autoLogin": true }
 * @NotBlank: null·빈 문자열·공백만 있는 값을 거부한다. @Size(max): 너무 긴 값으로 서버를 괴롭히는 것을 막는다.
 * autoLogin: true면 브라우저를 닫아도 로그인이 유지되도록 쿠키 만료일을 길게 준다(AuthenticationService.configureSessionCookie).
 */
public record LoginRequest(
    @NotBlank @Size(max = 100) String loginId,
    @NotBlank @Size(max = 200) String password,
    boolean autoLogin
) {
}
