package com.example.devnote.member.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.parameter.MemberCreateParameter;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.dto.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthenticationService {
    public static final String AUTHENTICATED_MEMBER_ID = "AUTHENTICATED_MEMBER_ID";
    private final MemberDao memberDao;
    private final MemberPasswordService passwordService;
    @Value("${auth.remember-me-duration:30d}")
    private Duration rememberMeDuration;
    @Value("${server.servlet.session.cookie.name:JSESSIONID}")
    private String sessionCookieName;
    @Value("${server.servlet.session.cookie.secure:false}")
    private boolean sessionCookieSecure;

    @Transactional
    public AuthSessionResponse login(LoginRequest request, HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        MemberRow member = memberDao.selectMemberByLoginId(request.loginId().trim());
        if (member == null || !passwordService.matches(request.password(), member.getPasswordHash())) {
            throw new BusinessException(ErrorCode.LOGIN_FAILED);
        }
        if (!"ACTIVE".equals(member.getAccountStatus())) {
            throw new BusinessException(ErrorCode.ACCOUNT_NOT_ACTIVE);
        }
        HttpSession session = servletRequest.getSession(true);
        servletRequest.changeSessionId();
        session.setAttribute(AUTHENTICATED_MEMBER_ID, member.getMemberId());
        configureSessionCookie(session, request.autoLogin(), servletResponse);
        memberDao.updateLastLoginAt(member.getMemberId());
        return toSession(memberDao.selectMemberById(member.getMemberId()));
    }

    @Transactional
    public AuthSessionResponse register(RegisterRequest request, HttpServletRequest servletRequest) {
        String loginId = request.loginId().trim();
        if (memberDao.selectMemberByLoginId(loginId) != null) {
            throw new BusinessException(ErrorCode.LOGIN_ID_ALREADY_EXISTS);
        }
        String normalizedEmail = request.email().trim().toLowerCase();
        if (memberDao.selectMemberByEmail(normalizedEmail) != null) {
            throw new BusinessException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        MemberCreateParameter parameter = MemberCreateParameter.builder()
            .loginId(loginId)
            .passwordHash(passwordService.encode(request.password()))
            .email(normalizedEmail)
            .memberName(request.memberName().trim())
            .memberRole(MemberRole.USER.name())
            .gradeCode(MemberGrade.BRONZE.name())
            .build();
        try {
            memberDao.insertMember(parameter);
        } catch (DuplicateKeyException exception) {
            if (memberDao.selectMemberByLoginId(loginId) != null) {
                throw new BusinessException(ErrorCode.LOGIN_ID_ALREADY_EXISTS);
            }
            if (memberDao.selectMemberByEmail(normalizedEmail) != null) {
                throw new BusinessException(ErrorCode.EMAIL_ALREADY_EXISTS);
            }
            throw exception;
        }
        HttpSession session = servletRequest.getSession(true);
        servletRequest.changeSessionId();
        session.setAttribute(AUTHENTICATED_MEMBER_ID, parameter.getMemberId());
        return toSession(memberDao.selectMemberById(parameter.getMemberId()));
    }

    public AuthSessionResponse getSession(HttpServletRequest request) {
        MemberRow member = findAuthenticatedMember(request);
        return member == null ? AuthSessionResponse.guest() : toSession(member);
    }

    public MemberRow findAuthenticatedMember(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return null;
        Object memberId = session.getAttribute(AUTHENTICATED_MEMBER_ID);
        if (!(memberId instanceof Long authenticatedMemberId)) return null;
        MemberRow member = memberDao.selectMemberById(authenticatedMemberId);
        return member != null && "ACTIVE".equals(member.getAccountStatus()) ? member : null;
    }

    public void logout(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        response.addHeader(HttpHeaders.SET_COOKIE, buildSessionCookie("", Duration.ZERO).toString());
    }

    private void configureSessionCookie(HttpSession session, boolean autoLogin, HttpServletResponse response) {
        if (autoLogin) session.setMaxInactiveInterval(Math.toIntExact(rememberMeDuration.toSeconds()));
        Duration maxAge = autoLogin ? rememberMeDuration : Duration.ofSeconds(-1);
        response.addHeader(HttpHeaders.SET_COOKIE, buildSessionCookie(session.getId(), maxAge).toString());
    }

    private ResponseCookie buildSessionCookie(String value, Duration maxAge) {
        return ResponseCookie.from(sessionCookieName, value)
            .httpOnly(true)
            .secure(sessionCookieSecure)
            .sameSite("Strict")
            .path("/")
            .maxAge(maxAge)
            .build();
    }

    private AuthSessionResponse toSession(MemberRow member) {
        MemberRole role = MemberRole.valueOf(member.getMemberRole());
        return new AuthSessionResponse(true, member.getMemberId(), member.getLoginId(), member.getMemberName(), member.getEmail(),
            MemberGrade.valueOf(member.getGradeCode()), role, role.isAdministrator(), role == MemberRole.SUPER_ADMIN);
    }
}
