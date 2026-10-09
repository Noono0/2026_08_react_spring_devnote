package com.example.devnote.member.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CurrentMemberProviderTest {
    @Mock private AuthenticationService authenticationService;

    @Test
    void loggedInMemberIsUsedInBothModes() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Member-Id", "2");
        MemberRow member = new MemberRow();
        member.setMemberId(7L);
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member);

        // 로그인 세션이 있으면 헤더는 보지 않는다.
        assertThat(new CurrentMemberProvider(authenticationService, false).getCurrentMemberId(request)).isEqualTo(7L);
    }

    @Test
    void localModeKeepsLearningHeaderAndDefaultMember() {
        CurrentMemberProvider provider = new CurrentMemberProvider(authenticationService, true);
        MockHttpServletRequest withHeader = new MockHttpServletRequest();
        withHeader.addHeader("X-Member-Id", "2");

        assertThat(provider.getCurrentMemberId(withHeader)).isEqualTo(2L);
        assertThat(provider.getCurrentMemberId(new MockHttpServletRequest())).isEqualTo(1L);
    }

    @Test
    void productionModeRejectsGuestEvenWithMemberHeader() {
        CurrentMemberProvider provider = new CurrentMemberProvider(authenticationService, false);
        MockHttpServletRequest forgedRequest = new MockHttpServletRequest();
        // 공격자가 헤더로 1번 회원(슈퍼관리자)인 척해도 로그인 세션이 없으면 401.
        forgedRequest.addHeader("X-Member-Id", "1");

        assertThatThrownBy(() -> provider.getCurrentMemberId(forgedRequest))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AUTHENTICATION_REQUIRED));
        assertThatThrownBy(() -> provider.getCurrentMemberId(new MockHttpServletRequest()))
            .isInstanceOf(BusinessException.class);
    }
}
