package com.example.devnote.member.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.MemberDao;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.dto.LoginRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceTest {
    @Mock private MemberDao memberDao;
    @Mock private MemberPasswordService passwordService;
    @Mock private HttpServletRequest request;
    @Mock private HttpServletResponse response;
    @Mock private HttpSession session;

    private AuthenticationService authenticationService;
    private LoginAttemptLimiter loginAttemptLimiter;

    @BeforeEach
    void setUp() {
        // 실패 제한기는 가짜가 아니라 실제 객체를 쓴다(5번 실패 시 잠금, 고정된 시계).
        loginAttemptLimiter = new LoginAttemptLimiter(
            Clock.fixed(Instant.parse("2026-10-08T00:00:00Z"), ZoneOffset.UTC), 5, Duration.ofMinutes(15), Duration.ofMinutes(15));
        authenticationService = new AuthenticationService(memberDao, passwordService, loginAttemptLimiter);
        ReflectionTestUtils.setField(authenticationService, "rememberMeDuration", Duration.ofDays(30));
        ReflectionTestUtils.setField(authenticationService, "sessionCookieName", "JSESSIONID");
        ReflectionTestUtils.setField(authenticationService, "sessionCookieSecure", false);
    }

    @Test
    void autoLoginCreatesPersistentHttpOnlySessionWithoutStoringPassword() {
        MemberRow member = activeMember();
        when(memberDao.selectMemberByLoginId("admin")).thenReturn(member);
        when(passwordService.matches("admin1234", member.getPasswordHash())).thenReturn(true);
        when(request.getSession(true)).thenReturn(session);
        when(session.getId()).thenReturn("session-1");
        when(memberDao.selectMemberById(member.getMemberId())).thenReturn(member);

        authenticationService.login(new LoginRequest("admin", "admin1234", true), request, response);

        verify(session).setMaxInactiveInterval(2_592_000);
        ArgumentCaptor<String> cookieCaptor = ArgumentCaptor.forClass(String.class);
        verify(response).addHeader(eq(HttpHeaders.SET_COOKIE), cookieCaptor.capture());
        assertThat(cookieCaptor.getValue())
            .contains("JSESSIONID=session-1", "Max-Age=2592000", "Path=/", "HttpOnly", "SameSite=Strict")
            .doesNotContain("admin1234");
    }

    @Test
    void ordinaryLoginUsesBrowserSessionCookie() {
        MemberRow member = activeMember();
        when(memberDao.selectMemberByLoginId("admin")).thenReturn(member);
        when(passwordService.matches("admin1234", member.getPasswordHash())).thenReturn(true);
        when(request.getSession(true)).thenReturn(session);
        when(session.getId()).thenReturn("session-2");
        when(memberDao.selectMemberById(member.getMemberId())).thenReturn(member);

        authenticationService.login(new LoginRequest("admin", "admin1234", false), request, response);

        verify(session, never()).setMaxInactiveInterval(org.mockito.ArgumentMatchers.anyInt());
        ArgumentCaptor<String> cookieCaptor = ArgumentCaptor.forClass(String.class);
        verify(response).addHeader(eq(HttpHeaders.SET_COOKIE), cookieCaptor.capture());
        assertThat(cookieCaptor.getValue()).contains("JSESSIONID=session-2", "HttpOnly").doesNotContain("Max-Age=");
    }

    @Test
    void logoutInvalidatesSessionAndExpiresPersistentCookie() {
        when(request.getSession(false)).thenReturn(session);

        authenticationService.logout(request, response);

        verify(session).invalidate();
        ArgumentCaptor<String> cookieCaptor = ArgumentCaptor.forClass(String.class);
        verify(response).addHeader(eq(HttpHeaders.SET_COOKIE), cookieCaptor.capture());
        assertThat(cookieCaptor.getValue()).contains("JSESSIONID=", "Max-Age=0", "HttpOnly");
    }

    @Test
    void repeatedLoginFailuresLockEvenCorrectPasswordAndDoNotCheckPasswordWhileLocked() {
        MemberRow member = activeMember();
        when(request.getRemoteAddr()).thenReturn("203.0.113.10");
        when(memberDao.selectMemberByLoginId("admin")).thenReturn(member);
        when(passwordService.matches("wrong-password", member.getPasswordHash())).thenReturn(false);

        // 5번 틀린다.
        for (int attempt = 0; attempt < 5; attempt++) {
            assertThatThrownBy(() -> authenticationService.login(new LoginRequest("admin", "wrong-password", false), request, response))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).getErrorCode())
                .isEqualTo(ErrorCode.LOGIN_FAILED);
        }

        // 6번째는 맞는 비밀번호여도 429로 막고, 비밀번호 확인 자체를 하지 않는다.
        assertThatThrownBy(() -> authenticationService.login(new LoginRequest("admin", "admin1234", false), request, response))
            .isInstanceOf(BusinessException.class)
            .extracting(exception -> ((BusinessException) exception).getErrorCode())
            .isEqualTo(ErrorCode.LOGIN_TEMPORARILY_LOCKED);
        verify(passwordService, never()).matches(eq("admin1234"), org.mockito.ArgumentMatchers.anyString());
        verify(request, never()).getSession(true);
    }

    @Test
    void unknownLoginIdIsCountedAsFailureSoLockingDoesNotRevealWhichIdsExist() {
        when(request.getRemoteAddr()).thenReturn("203.0.113.11");
        when(memberDao.selectMemberByLoginId("ghost")).thenReturn(null);

        for (int attempt = 0; attempt < 5; attempt++) {
            assertThatThrownBy(() -> authenticationService.login(new LoginRequest("ghost", "any-password", false), request, response))
                .isInstanceOf(BusinessException.class);
        }

        assertThatThrownBy(() -> authenticationService.login(new LoginRequest("ghost", "any-password", false), request, response))
            .extracting(exception -> ((BusinessException) exception).getErrorCode())
            .isEqualTo(ErrorCode.LOGIN_TEMPORARILY_LOCKED);
    }

    private MemberRow activeMember() {
        MemberRow member = new MemberRow();
        member.setMemberId(1L);
        member.setLoginId("admin");
        member.setPasswordHash("encoded-password");
        member.setEmail("admin@example.com");
        member.setMemberName("슈퍼 관리자");
        member.setMemberRole("SUPER_ADMIN");
        member.setGradeCode("DIAMOND");
        member.setAccountStatus("ACTIVE");
        return member;
    }
}
