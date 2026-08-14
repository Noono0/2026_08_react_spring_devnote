package com.example.devnote.poll.service;

import com.example.devnote.admin.service.VisitorTrackingService;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.dto.MemberRole;
import com.example.devnote.member.service.AuthenticationService;
import com.example.devnote.poll.dao.PollDao;
import com.example.devnote.poll.dao.parameter.PollBallotParameter;
import com.example.devnote.poll.dao.parameter.PollCreateParameter;
import com.example.devnote.poll.dao.row.PollOptionRow;
import com.example.devnote.poll.dao.row.PollRow;
import com.example.devnote.poll.dto.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PollService {
    private static final long DEFAULT_DURATION_MINUTES = 60;
    private static final long MAXIMUM_DURATION_MINUTES = 60;

    private final PollDao pollDao;
    private final VisitorTrackingService visitorTrackingService;
    private final AuthenticationService authenticationService;

    public PageResponse<PollResponse> getPolls(PollSearchCondition condition, HttpServletRequest request) {
        String visitorKey = visitorTrackingService.resolveVisitorKey(request);
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        Instant now = Instant.now();
        List<PollResponse> content = pollDao.selectPolls(condition).stream()
            .map(poll -> toResponse(poll, visitorKey, member, now))
            .toList();
        return PageResponse.of(content, condition.getPageNumber(), condition.getPageSize(), pollDao.countPolls(condition));
    }

    @Transactional
    public PollResponse vote(Long pollId, PollVoteRequest voteRequest, HttpServletRequest request) {
        PollRow poll = requirePollForUpdate(pollId);
        Instant now = Instant.now();
        if (!"OPEN".equals(resolveStatus(poll, now))) throw new BusinessException(ErrorCode.POLL_CLOSED);

        List<Long> optionIds = voteRequest.optionIds();
        validateVoteSelectionCount(poll, optionIds);
        if (pollDao.countPollOptions(pollId, optionIds) != optionIds.size()) {
            throw new BusinessException(ErrorCode.POLL_OPTION_INVALID);
        }

        String visitorKey = visitorTrackingService.resolveVisitorKey(request);
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        Long memberId = member == null ? null : member.getMemberId();
        if (pollDao.existsVote(pollId, visitorKey, memberId)) throw new BusinessException(ErrorCode.POLL_ALREADY_VOTED);
        PollBallotParameter ballot = PollBallotParameter.builder()
            .pollId(pollId)
            .visitorKey(visitorKey)
            .memberId(memberId)
            .build();
        try {
            pollDao.insertPollBallot(ballot);
            optionIds.forEach(optionId -> pollDao.insertPollBallotSelection(ballot.getPollBallotId(), optionId));
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ErrorCode.POLL_ALREADY_VOTED);
        }
        return toResponse(requirePoll(pollId), visitorKey, member, now);
    }

    @Transactional
    public PollResponse create(PollCreateRequest createRequest, HttpServletRequest request) {
        MemberRow creator = requireAuthenticatedMember(request);
        Instant now = Instant.now();
        PollCreateParameter parameter = toDefinitionParameter(null, createRequest, creator.getMemberId(), now);
        pollDao.insertPoll(parameter);
        insertOptions(parameter.getPollId(), normalizedOptions(createRequest));
        return toResponse(requirePoll(parameter.getPollId()), visitorTrackingService.resolveVisitorKey(request), creator, now);
    }

    @Transactional
    public PollResponse update(Long pollId, PollCreateRequest updateRequest, HttpServletRequest request) {
        PollRow poll = requirePoll(pollId);
        MemberRow editor = requireManager(poll, request);
        Instant now = Instant.now();
        if (!"OPEN".equals(resolveStatus(poll, now))) throw new BusinessException(ErrorCode.POLL_CLOSED);

        List<String> nextOptions = normalizedOptions(updateRequest);
        long participantCount = pollDao.countPollBallots(pollId);
        if (participantCount > 0 && !hasSameOptions(pollId, nextOptions)) {
            throw new BusinessException(ErrorCode.POLL_EDIT_NOT_ALLOWED);
        }

        PollCreateParameter parameter = toDefinitionParameter(pollId, updateRequest, poll.getCreatedBy(), now);
        pollDao.updatePollDefinition(parameter);
        if (participantCount == 0) {
            pollDao.deletePollOptions(pollId);
            insertOptions(pollId, nextOptions);
        }
        return toResponse(requirePoll(pollId), visitorTrackingService.resolveVisitorKey(request), editor, now);
    }

    @Transactional
    public PollResponse updateStatus(Long pollId, PollStatusUpdateRequest updateRequest, HttpServletRequest request) {
        PollRow poll = requirePoll(pollId);
        MemberRow manager = requireManager(poll, request);
        Instant now = Instant.now();
        String currentStatus = resolveStatus(poll, now);
        String nextStatus = updateRequest.status();

        boolean canClose = "CLOSED".equals(nextStatus) && "OPEN".equals(currentStatus);
        boolean canPublish = "RESULTS_PUBLISHED".equals(nextStatus) && "CLOSED".equals(currentStatus);
        if (!canClose && !canPublish) throw new BusinessException(ErrorCode.POLL_STATUS_INVALID);

        pollDao.updatePollStatus(pollId, nextStatus);
        return toResponse(requirePoll(pollId), visitorTrackingService.resolveVisitorKey(request), manager, now);
    }

    @Transactional
    public void delete(Long pollId, HttpServletRequest request) {
        requirePoll(pollId);
        MemberRow administrator = requireAdministrator(request);
        if (pollDao.softDeletePoll(pollId, administrator.getMemberId()) == 0) {
            throw new BusinessException(ErrorCode.POLL_NOT_FOUND);
        }
    }

    private void validateVoteSelectionCount(PollRow poll, List<Long> optionIds) {
        Set<Long> distinctOptionIds = new HashSet<>(optionIds);
        int maximumSelections = Boolean.TRUE.equals(poll.getAllowMultiple()) ? poll.getMaxSelections() : 1;
        if (distinctOptionIds.size() != optionIds.size() || optionIds.isEmpty() || optionIds.size() > maximumSelections) {
            throw new BusinessException(ErrorCode.POLL_SELECTION_COUNT_INVALID);
        }
    }

    private PollCreateParameter toDefinitionParameter(Long pollId, PollCreateRequest request, Long createdBy, Instant now) {
        List<String> options = normalizedOptions(request);
        boolean allowMultiple = request.allowMultiple();
        int maxSelections = request.maxSelections();
        if ((!allowMultiple && maxSelections != 1)
            || (allowMultiple && (maxSelections < 2 || maxSelections > options.size()))) {
            throw new BusinessException(ErrorCode.POLL_SELECTION_COUNT_INVALID);
        }

        Instant endsAt = request.endsAt() == null ? now.plus(DEFAULT_DURATION_MINUTES, ChronoUnit.MINUTES) : request.endsAt();
        if (!endsAt.isAfter(now) || endsAt.isAfter(now.plus(MAXIMUM_DURATION_MINUTES, ChronoUnit.MINUTES).plusSeconds(5))) {
            throw new BusinessException(ErrorCode.POLL_END_TIME_INVALID);
        }

        return PollCreateParameter.builder()
            .pollId(pollId)
            .question(request.question().trim())
            .allowMultiple(allowMultiple)
            .maxSelections(maxSelections)
            .realtimeResults(request.realtimeResults())
            .endsAt(LocalDateTime.ofInstant(endsAt, ZoneOffset.UTC))
            .createdBy(createdBy)
            .build();
    }

    private List<String> normalizedOptions(PollCreateRequest request) {
        List<String> options = request.options().stream().map(String::trim).toList();
        Set<String> uniqueOptions = new HashSet<>();
        boolean duplicated = options.stream()
            .map(option -> option.toLowerCase(Locale.ROOT))
            .anyMatch(option -> !uniqueOptions.add(option));
        if (duplicated) throw new BusinessException(ErrorCode.POLL_OPTION_INVALID);
        return options;
    }

    private boolean hasSameOptions(Long pollId, List<String> nextOptions) {
        List<String> currentOptions = pollDao.selectPollOptions(pollId).stream().map(PollOptionRow::getOptionLabel).toList();
        return currentOptions.equals(nextOptions);
    }

    private void insertOptions(Long pollId, List<String> options) {
        for (int index = 0; index < options.size(); index++) {
            pollDao.insertPollOption(pollId, options.get(index), index + 1);
        }
    }

    private PollRow requirePoll(Long pollId) {
        PollRow poll = pollDao.selectPoll(pollId);
        if (poll == null) throw new BusinessException(ErrorCode.POLL_NOT_FOUND);
        return poll;
    }

    private PollRow requirePollForUpdate(Long pollId) {
        PollRow poll = pollDao.selectPollForUpdate(pollId);
        if (poll == null) throw new BusinessException(ErrorCode.POLL_NOT_FOUND);
        return poll;
    }

    private MemberRow requireAuthenticatedMember(HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        if (member == null) throw new BusinessException(ErrorCode.AUTHENTICATION_REQUIRED);
        return member;
    }

    private MemberRow requireManager(PollRow poll, HttpServletRequest request) {
        MemberRow member = requireAuthenticatedMember(request);
        boolean creator = poll.getCreatedBy().equals(member.getMemberId());
        boolean administrator = MemberRole.valueOf(member.getMemberRole()).isAdministrator();
        if (!creator && !administrator) throw new BusinessException(ErrorCode.ACCESS_DENIED);
        return member;
    }

    private MemberRow requireAdministrator(HttpServletRequest request) {
        MemberRow member = requireAuthenticatedMember(request);
        if (!MemberRole.valueOf(member.getMemberRole()).isAdministrator()) {
            throw new BusinessException(ErrorCode.ACCESS_DENIED);
        }
        return member;
    }

    private String resolveStatus(PollRow poll, Instant now) {
        if (!"OPEN".equals(poll.getPollStatus())) return poll.getPollStatus();
        return now.isBefore(resolveEndsAt(poll)) ? "OPEN" : "CLOSED";
    }

    private Instant resolveEndsAt(PollRow poll) {
        LocalDateTime endsAt = poll.getEndsAt() == null
            ? poll.getCreatedAt().plusMinutes(DEFAULT_DURATION_MINUTES)
            : poll.getEndsAt();
        return endsAt.toInstant(ZoneOffset.UTC);
    }

    private PollResponse toResponse(PollRow poll, String visitorKey, MemberRow currentMember, Instant now) {
        String status = resolveStatus(poll, now);
        boolean resultsVisible = Boolean.TRUE.equals(poll.getRealtimeResults()) || "RESULTS_PUBLISHED".equals(status);
        List<PollOptionResponse> options = pollDao.selectPollOptions(poll.getPollId()).stream()
            .map(option -> new PollOptionResponse(
                option.getPollOptionId(),
                option.getOptionLabel(),
                resultsVisible ? option.getVoteCount() : null
            ))
            .toList();
        Long totalSelections = resultsVisible
            ? options.stream().map(PollOptionResponse::votes).reduce(0L, Long::sum)
            : null;
        Long currentMemberId = currentMember == null ? null : currentMember.getMemberId();
        List<Long> selectedOptionIds = pollDao.selectVotedOptionIds(poll.getPollId(), visitorKey, currentMemberId);
        boolean administrator = currentMember != null
            && MemberRole.valueOf(currentMember.getMemberRole()).isAdministrator();
        boolean manageable = currentMember != null
            && (poll.getCreatedBy().equals(currentMember.getMemberId()) || administrator);
        Instant resultPublishedAt = poll.getResultPublishedAt() == null
            ? null
            : poll.getResultPublishedAt().toInstant(ZoneOffset.UTC);

        return new PollResponse(
            poll.getPollId(), poll.getQuestion(), status, options, totalSelections,
            pollDao.countPollBallots(poll.getPollId()), !selectedOptionIds.isEmpty(), selectedOptionIds,
            Boolean.TRUE.equals(poll.getAllowMultiple()), poll.getMaxSelections(),
            Boolean.TRUE.equals(poll.getRealtimeResults()), resultsVisible, manageable, administrator,
            poll.getCreatedBy(), poll.getCreatorName(), resolveEndsAt(poll), resultPublishedAt,
            poll.getCreatedAt().toInstant(ZoneOffset.UTC)
        );
    }
}
