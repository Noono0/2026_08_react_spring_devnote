package com.example.devnote.poll.service;

import com.example.devnote.admin.service.VisitorTrackingService;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import com.example.devnote.poll.dao.PollDao;
import com.example.devnote.poll.dao.row.PollRow;
import com.example.devnote.poll.dto.PollCreateRequest;
import com.example.devnote.poll.dto.PollSearchCondition;
import com.example.devnote.poll.dto.PollVoteRequest;
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
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class PollServiceTest {
    @Mock private PollDao pollDao;
    @Mock private VisitorTrackingService visitorTrackingService;
    @Mock private AuthenticationService authenticationService;

    @Test
    void visitorCannotVoteTwiceInSamePoll() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        PollRow poll = openPoll(1L, false, 1);
        when(pollDao.selectPollForUpdate(1L)).thenReturn(poll);
        when(pollDao.countPollOptions(1L, List.of(10L))).thenReturn(1);
        when(visitorTrackingService.resolveVisitorKey(request)).thenReturn("visitor-key");
        when(pollDao.existsVote(1L, "visitor-key", null)).thenReturn(true);
        PollService service = new PollService(pollDao, visitorTrackingService, authenticationService);

        assertThatThrownBy(() -> service.vote(1L, new PollVoteRequest(List.of(10L)), request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.POLL_ALREADY_VOTED));
    }

    @Test
    void multipleChoiceCannotExceedConfiguredMaximum() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(pollDao.selectPollForUpdate(1L)).thenReturn(openPoll(1L, true, 2));
        PollService service = new PollService(pollDao, visitorTrackingService, authenticationService);

        assertThatThrownBy(() -> service.vote(1L, new PollVoteRequest(List.of(10L, 11L, 12L)), request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.POLL_SELECTION_COUNT_INVALID));
    }

    @Test
    void unauthenticatedVisitorCannotCreatePoll() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(null);
        PollService service = new PollService(pollDao, visitorTrackingService, authenticationService);

        PollCreateRequest createRequest = new PollCreateRequest(
            "짜장면 vs 짬뽕", List.of("짜장면", "짬뽕"), false, 1, true, null
        );
        assertThatThrownBy(() -> service.create(createRequest, request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.AUTHENTICATION_REQUIRED));
    }

    @Test
    void administratorCanSoftDeletePoll() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        PollRow poll = openPoll(1L, false, 1);
        MemberRow administrator = new MemberRow();
        administrator.setMemberId(3L);
        administrator.setMemberRole("ADMIN");
        when(pollDao.selectPoll(1L)).thenReturn(poll);
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(administrator);
        when(pollDao.softDeletePoll(1L, 3L)).thenReturn(1);
        PollService service = new PollService(pollDao, visitorTrackingService, authenticationService);

        service.delete(1L, request);

        verify(pollDao).softDeletePoll(1L, 3L);
    }

    @Test
    void pollListReturnsServerPagingInformation() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        PollSearchCondition condition = new PollSearchCondition();
        condition.setPageNumber(2);
        condition.setPageSize(10);
        when(visitorTrackingService.resolveVisitorKey(request)).thenReturn("visitor-key");
        when(pollDao.selectPolls(condition)).thenReturn(List.of());
        when(pollDao.countPolls(condition)).thenReturn(25L);
        PollService service = new PollService(pollDao, visitorTrackingService, authenticationService);

        var response = service.getPolls(condition, request);

        assertThat(response.pageInformation().pageNumber()).isEqualTo(2);
        assertThat(response.pageInformation().pageSize()).isEqualTo(10);
        assertThat(response.pageInformation().totalElements()).isEqualTo(25);
        assertThat(response.pageInformation().totalPages()).isEqualTo(3);
        assertThat(response.pageInformation().lastPage()).isTrue();
    }

    @Test
    void regularMemberCannotDeletePoll() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MemberRow member = new MemberRow();
        member.setMemberId(9L);
        member.setMemberRole("USER");
        when(pollDao.selectPoll(1L)).thenReturn(openPoll(1L, false, 1));
        when(authenticationService.findAuthenticatedMember(request)).thenReturn(member);
        PollService service = new PollService(pollDao, visitorTrackingService, authenticationService);

        assertThatThrownBy(() -> service.delete(1L, request))
            .isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED));
        verify(pollDao, never()).softDeletePoll(1L, 9L);
    }

    private PollRow openPoll(Long pollId, boolean allowMultiple, int maxSelections) {
        PollRow poll = new PollRow();
        poll.setPollId(pollId);
        poll.setPollStatus("OPEN");
        poll.setAllowMultiple(allowMultiple);
        poll.setMaxSelections(maxSelections);
        poll.setRealtimeResults(true);
        poll.setCreatedAt(java.time.LocalDateTime.now(java.time.ZoneOffset.UTC));
        poll.setEndsAt(java.time.LocalDateTime.now(java.time.ZoneOffset.UTC).plusMinutes(30));
        return poll;
    }
}
