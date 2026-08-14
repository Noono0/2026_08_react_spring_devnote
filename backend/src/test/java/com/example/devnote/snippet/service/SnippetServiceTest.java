package com.example.devnote.snippet.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import com.example.devnote.snippet.dao.SnippetDao;
import com.example.devnote.snippet.dto.SnippetSearchCondition;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SnippetServiceTest {
    @Mock private SnippetDao snippetDao;
    @Mock private AuthenticationService authenticationService;

    @Test
    void listUsesAuthenticatedMemberIdAndServerPaging() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MemberRow member = member(17L);
        SnippetSearchCondition condition = new SnippetSearchCondition();
        condition.setPageNumber(1);
        condition.setPageSize(10);
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member);
        when(snippetDao.selectSnippets(condition)).thenReturn(List.of());
        when(snippetDao.countSnippets(condition)).thenReturn(13L);
        SnippetService service = new SnippetService(snippetDao, authenticationService, new ObjectMapper());

        var response = service.getSnippets(condition, request);

        assertThat(condition.getMemberId()).isEqualTo(17L);
        assertThat(response.pageInformation().totalElements()).isEqualTo(13L);
        assertThat(response.pageInformation().totalPages()).isEqualTo(2);
        verify(snippetDao).selectSnippets(condition);
    }

    @Test
    void guestCannotReadSnippets() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(null);
        SnippetService service = new SnippetService(snippetDao, authenticationService, new ObjectMapper());

        assertThatThrownBy(() -> service.getSnippets(new SnippetSearchCondition(), request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AUTHENTICATION_REQUIRED));
    }

    private MemberRow member(Long memberId) {
        MemberRow member = new MemberRow();
        member.setMemberId(memberId);
        member.setMemberRole("USER");
        return member;
    }
}

