package com.example.devnote.board.todo.controller;

import com.example.devnote.board.todo.dao.TodoGuestDao;
import com.example.devnote.board.todo.dao.TodoGuestRow;
import com.example.devnote.board.todo.domain.TodoOwner;
import com.example.devnote.board.todo.dto.TodoDtos.OwnerView;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.service.AuthenticationService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

/** 쿠키의 원문은 이 경계 안에서만 사용하고 Service·응답·DB에는 전달하지 않는다. */
@Component
public class TodoOwnerResolver {
    public static final String COOKIE_NAME = "DEVNOTE_TODO_GUEST";
    public static final String COOKIE_PATH = "/api/v1/board-todos";
    private final AuthenticationService authentication;
    private final TodoGuestDao guests;
    private final boolean secure;
    private final SecureRandom random = new SecureRandom();

    public TodoOwnerResolver(AuthenticationService authentication, TodoGuestDao guests,
        @Value("${server.servlet.session.cookie.secure:false}") boolean secure) {
        this.authentication = authentication;
        this.guests = guests;
        this.secure = secure;
    }

    public OwnerView initialize(HttpServletRequest request, HttpServletResponse response) {
        var member = authentication.findAuthenticatedMember(request);
        if (member != null) return new OwnerView("MEMBER", "member:" + member.getMemberId());
        String token = token(request);
        TodoGuestRow guest = token == null ? null : guests.findByTokenHash(hash(token));
        if (guest == null) {
            byte[] bytes = new byte[32];
            random.nextBytes(bytes);
            token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            guest = new TodoGuestRow();
            guest.setTokenHash(hash(token));
            guest.setPublicId(UUID.randomUUID().toString());
            guests.insert(guest);
        }
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(COOKIE_NAME, token).httpOnly(true).secure(secure)
            .sameSite("Strict").path(COOKIE_PATH).maxAge(Duration.ofDays(365)).build().toString());
        return new OwnerView("GUEST", "guest:" + guest.getPublicId());
    }

    public TodoOwner resolve(HttpServletRequest request) {
        var member = authentication.findAuthenticatedMember(request);
        if (member != null) return TodoOwner.member(member.getMemberId());
        var guest = findGuest(request);
        if (guest == null) throw new BusinessException(ErrorCode.TODO_GUEST_COOKIE_REQUIRED);
        return TodoOwner.guest(guest.getGuestId());
    }

    public long requireMember(HttpServletRequest request) {
        var member = authentication.findAuthenticatedMember(request);
        if (member == null) throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED);
        return member.getMemberId();
    }

    /** 로그인 중에도 남아 있는 비회원 쿠키를 확인한다. 새 비회원은 만들지 않는다. */
    public TodoGuestRow findGuest(HttpServletRequest request) {
        String token = token(request);
        return token == null ? null : guests.findByTokenHash(hash(token));
    }

    private String token(HttpServletRequest request) {
        String value = null;
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) {
            if (!COOKIE_NAME.equals(cookie.getName())) continue;
            if (value != null || cookie.getValue() == null || !cookie.getValue().matches("[A-Za-z0-9_-]{43}")) return null;
            value = cookie.getValue();
        }
        return value;
    }

    private String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception); }
    }
}
