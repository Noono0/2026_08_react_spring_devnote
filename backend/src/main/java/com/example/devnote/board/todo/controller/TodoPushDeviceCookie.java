package com.example.devnote.board.todo.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/** 기기 쿠키 원문은 경계 밖으로 보내지 않는다. / Only the device hash leaves this boundary. */
@Component
public class TodoPushDeviceCookie {
    public static final String NAME = "DEVNOTE_TODO_PUSH_DEVICE";
    private final boolean secure;
    private final SecureRandom random = new SecureRandom();
    public TodoPushDeviceCookie(@Value("${server.servlet.session.cookie.secure:false}") boolean secure) { this.secure = secure; }

    public String initialize(HttpServletRequest request, HttpServletResponse response) {
        String token = read(request);
        if (token == null) {
            byte[] bytes = new byte[32]; random.nextBytes(bytes);
            token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        }
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(NAME, token).httpOnly(true).secure(secure)
            .sameSite("Strict").path("/api/v1").maxAge(Duration.ofDays(365)).build().toString());
        return hash(token);
    }
    public String deviceHash(HttpServletRequest request) {
        String token = read(request);
        return token == null ? null : hash(token);
    }
    private String read(HttpServletRequest request) {
        String found = null;
        if (request.getCookies() == null) return null;
        for (var cookie : request.getCookies()) {
            if (!NAME.equals(cookie.getName())) continue;
            if (found != null || cookie.getValue() == null || !cookie.getValue().matches("[A-Za-z0-9_-]{43}")) return null;
            found = cookie.getValue();
        }
        return found;
    }
    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception); }
    }
}
