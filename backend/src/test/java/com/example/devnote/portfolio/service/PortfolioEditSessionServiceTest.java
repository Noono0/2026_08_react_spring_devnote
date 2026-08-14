package com.example.devnote.portfolio.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioEditSessionServiceTest {
    @Mock private AuthenticationService authenticationService;

    @Test
    void onlySuperAdministratorCanEditPortfolio() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Portfolio-Editor", "true");
        MemberRow member = new MemberRow();
        member.setMemberRole("SUPER_ADMIN");
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member);
        PortfolioEditSessionService service = new PortfolioEditSessionService(authenticationService);

        assertThat(service.isUnlocked(request)).isTrue();
        service.requireEditor(request);
    }

    @Test
    void regularMemberCannotEditPortfolio() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Portfolio-Editor", "true");
        MemberRow member = new MemberRow();
        member.setMemberRole("USER");
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member);
        PortfolioEditSessionService service = new PortfolioEditSessionService(authenticationService);

        assertThatThrownBy(() -> service.requireEditor(request)).isInstanceOf(BusinessException.class);
    }
}
