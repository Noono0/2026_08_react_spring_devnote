package com.example.devnote.crawler.config;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CrawlerAccessInterceptorTest {
    @Mock private AuthenticationService authenticationService;

    private final MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/utilities/crawler/run");
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    private MemberRow memberWithRole(String role) {
        MemberRow member = new MemberRow();
        member.setMemberId(7L);
        member.setMemberRole(role);
        return member;
    }

    @Test
    void guestGetsAuthenticationRequired() {
        CrawlerAccessInterceptor interceptor = new CrawlerAccessInterceptor(authenticationService);
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(null);

        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AUTHENTICATION_REQUIRED));
    }

    @Test
    void ordinaryAdministratorIsDenied() {
        CrawlerAccessInterceptor interceptor = new CrawlerAccessInterceptor(authenticationService);
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(memberWithRole("ADMIN"));

        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    void superAdministratorPasses() {
        CrawlerAccessInterceptor interceptor = new CrawlerAccessInterceptor(authenticationService);
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(memberWithRole("SUPER_ADMIN"));

        assertThat(interceptor.preHandle(request, response, new Object())).isTrue();
    }
}
