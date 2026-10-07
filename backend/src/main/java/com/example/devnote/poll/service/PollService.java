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

/**
 * 토픽 투표의 업무 규칙입니다.
 *
 * [중복 투표 막기 — 세 겹]
 *   1. existsVote: 같은 브라우저 세션(visitorKey) 또는 같은 회원이 이미 투표했으면 거부
 *   2. selectPollForUpdate(FOR UPDATE): 같은 투표에 동시에 들어온 요청을 순서대로 처리
 *   3. DB UNIQUE(poll_id, visitor_key): 그래도 겹치면 DuplicateKeyException → "이미 투표함"으로 변환
 *
 * [상태 계산] DB에 OPEN으로 저장돼 있어도 마감 시각이 지났으면 CLOSED로 본다(resolveStatus).
 *   마감 시각에 맞춰 DB를 바꾸는 예약 작업 없이, 읽을 때마다 계산한다.
 *
 * [시간] 모든 시각은 UTC로 다룬다(Instant ↔ LocalDateTime 변환에 ZoneOffset.UTC 사용).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PollService {
    // 마감 시각을 비우면 60분 뒤, 직접 정해도 최대 60분까지(짧은 실시간 토픽 투표용).
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
        // ① 투표 행을 잠그고 읽는다. 트랜잭션이 끝날 때까지 같은 투표에 대한 다른 투표 요청은 여기서 기다린다.
        PollRow poll = requirePollForUpdate(pollId);
        Instant now = Instant.now();
        if (!"OPEN".equals(resolveStatus(poll, now))) throw new BusinessException(ErrorCode.POLL_CLOSED);

        // ② 고른 개수가 규칙에 맞는지, 선택지가 모두 이 투표의 것인지 확인한다.
        List<Long> optionIds = voteRequest.optionIds();
        validateVoteSelectionCount(poll, optionIds);
        if (pollDao.countPollOptions(pollId, optionIds) != optionIds.size()) {
            throw new BusinessException(ErrorCode.POLL_OPTION_INVALID);
        }

        // ③ 누가 투표하는지 정한다: 브라우저 세션 키 + (로그인했다면) 회원 번호.
        String visitorKey = visitorTrackingService.resolveVisitorKey(request);
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        Long memberId = member == null ? null : member.getMemberId();
        if (pollDao.existsVote(pollId, visitorKey, memberId)) throw new BusinessException(ErrorCode.POLL_ALREADY_VOTED);
        PollBallotParameter ballot = PollBallotParameter.builder()
            .pollId(pollId)
            .visitorKey(visitorKey)
            .memberId(memberId)
            .build();
        // ④ 투표지 1장을 만들고, 고른 선택지마다 한 줄씩 저장한다.
        try {
            pollDao.insertPollBallot(ballot);
            optionIds.forEach(optionId -> pollDao.insertPollBallotSelection(ballot.getPollBallotId(), optionId));
        // 위의 확인을 통과했어도 DB 고유 제약에 걸렸다면 동시 요청으로 이미 저장된 것이므로 같은 오류로 알려 준다.
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

        // 이미 누군가 투표했다면 선택지 구성을 바꿀 수 없다(기존 표의 의미가 달라지기 때문). 질문·마감 시각 등은 바꿀 수 있다.
        List<String> nextOptions = normalizedOptions(updateRequest);
        long participantCount = pollDao.countPollBallots(pollId);
        if (participantCount > 0 && !hasSameOptions(pollId, nextOptions)) {
            throw new BusinessException(ErrorCode.POLL_EDIT_NOT_ALLOWED);
        }

        PollCreateParameter parameter = toDefinitionParameter(pollId, updateRequest, poll.getCreatedBy(), now);
        pollDao.updatePollDefinition(parameter);
        // 아직 투표가 없을 때만 선택지를 지우고 새로 넣는다.
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

        // 허용되는 이동은 두 가지뿐: 진행 중 → 마감, 마감 → 결과 공개.
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

    /** 같은 선택지를 두 번 보냈거나, 0개이거나, 허용 개수(단일 선택이면 1)를 넘으면 거부한다. */
    private void validateVoteSelectionCount(PollRow poll, List<Long> optionIds) {
        Set<Long> distinctOptionIds = new HashSet<>(optionIds);
        int maximumSelections = Boolean.TRUE.equals(poll.getAllowMultiple()) ? poll.getMaxSelections() : 1;
        if (distinctOptionIds.size() != optionIds.size() || optionIds.isEmpty() || optionIds.size() > maximumSelections) {
            throw new BusinessException(ErrorCode.POLL_SELECTION_COUNT_INVALID);
        }
    }

    /**
     * 생성·수정 요청을 검사하고 DB용 값으로 바꾼다.
     *   단일 선택 → maxSelections는 1, 복수 선택 → 2 이상이고 선택지 개수 이하.
     *   마감 시각 → 지금보다 뒤이고 60분 이내(네트워크 지연을 감안해 5초 여유).
     */
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

    /** 앞뒤 공백을 지우고, 대소문자만 다른 중복("React"와 "react")이 있으면 거부한다. Set.add는 이미 있으면 false를 돌려준다. */
    private List<String> normalizedOptions(PollCreateRequest request) {
        List<String> options = request.options().stream().map(String::trim).toList();
        Set<String> uniqueOptions = new HashSet<>();
        boolean duplicated = options.stream()
            .map(option -> option.toLowerCase(Locale.ROOT))
            .anyMatch(option -> !uniqueOptions.add(option));
        if (duplicated) throw new BusinessException(ErrorCode.POLL_OPTION_INVALID);
        return options;
    }

    /** 저장된 선택지와 새 선택지가 순서까지 똑같은지 비교한다. */
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

    /** 로그인했고, 투표를 만든 사람이거나 관리자일 때만 통과. */
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

    /** DB 상태가 OPEN이면 마감 시각과 비교해 실제 상태를 계산한다. CLOSED·RESULTS_PUBLISHED는 그대로 쓴다. */
    private String resolveStatus(PollRow poll, Instant now) {
        if (!"OPEN".equals(poll.getPollStatus())) return poll.getPollStatus();
        return now.isBefore(resolveEndsAt(poll)) ? "OPEN" : "CLOSED";
    }

    /** 마감 시각이 없던 예전 데이터는 만든 시각 + 60분을 마감으로 본다. */
    private Instant resolveEndsAt(PollRow poll) {
        LocalDateTime endsAt = poll.getEndsAt() == null
            ? poll.getCreatedAt().plusMinutes(DEFAULT_DURATION_MINUTES)
            : poll.getEndsAt();
        return endsAt.toInstant(ZoneOffset.UTC);
    }

    /**
     * DB 값을 "지금 이 사용자에게 보여 줄" 응답으로 바꾼다.
     * 결과를 볼 수 없는 상태면 선택지별 표 수와 합계를 null로 숨긴다(응답을 열어 봐도 결과를 알 수 없게).
     */
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
            // reduce(0L, Long::sum): 0에서 시작해 모든 표 수를 더한다.
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
