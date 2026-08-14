package com.example.devnote.member.service;

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

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
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

    @BeforeEach
    void setUp() {
        authenticationService = new AuthenticationService(memberDao, passwordService);
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
