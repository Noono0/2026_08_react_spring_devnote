package com.example.devnote.poll.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.poll.dto.*;
import com.example.devnote.poll.service.PollService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 토픽 투표 API입니다. (/api/v1/polls)
 *
 * [누가 무엇을 할 수 있나] (판단은 PollService)
 *   목록 보기·투표 : 누구나(비회원은 브라우저 세션 기준으로 한 번)
 *   만들기       : 로그인한 회원
 *   수정·상태 변경: 만든 사람 또는 관리자
 *   삭제         : 관리자
 */
@RestController
@RequestMapping("/api/v1/polls")
@RequiredArgsConstructor
public class PollController {
    private final PollService pollService;

    // GET /api/v1/polls?status=OPEN&pageNumber=0 → @ModelAttribute를 생략해도 객체 파라미터는 쿼리 문자열로 채워진다.
    @GetMapping
    public ApiResponse<PageResponse<PollResponse>> getPolls(@Valid PollSearchCondition condition, HttpServletRequest request) {
        return ApiResponse.success(pollService.getPolls(condition, request));
    }

    // POST /api/v1/polls/1/votes  { "optionIds": [3, 5] } → 투표 후 갱신된 투표 정보를 돌려준다.
    @PostMapping("/{pollId}/votes")
    public ApiResponse<PollResponse> vote(@PathVariable Long pollId, @Valid @RequestBody PollVoteRequest voteRequest, HttpServletRequest request) {
        return ApiResponse.success(pollService.vote(pollId, voteRequest, request));
    }

    @PostMapping
    public ApiResponse<PollResponse> create(@Valid @RequestBody PollCreateRequest createRequest, HttpServletRequest request) {
        return ApiResponse.created(pollService.create(createRequest, request));
    }

    // 수정은 생성과 같은 요청 모양(PollCreateRequest)을 쓴다. 이미 투표한 사람이 있으면 선택지는 바꿀 수 없다.
    @PutMapping("/{pollId}")
    public ApiResponse<PollResponse> update(@PathVariable Long pollId, @Valid @RequestBody PollCreateRequest updateRequest, HttpServletRequest request) {
        return ApiResponse.success(pollService.update(pollId, updateRequest, request));
    }

    // 상태 변경: OPEN → CLOSED(마감) → RESULTS_PUBLISHED(결과 공개) 순서로만 갈 수 있다.
    @PutMapping("/{pollId}/status")
    public ApiResponse<PollResponse> updateStatus(@PathVariable Long pollId, @Valid @RequestBody PollStatusUpdateRequest updateRequest, HttpServletRequest request) {
        return ApiResponse.success(pollService.updateStatus(pollId, updateRequest, request));
    }

    // 삭제는 소프트 삭제(use_yn='N')이며, 누가 지웠는지(deleted_by) 남긴다.
    @DeleteMapping("/{pollId}")
    public ApiResponse<Void> delete(@PathVariable Long pollId, HttpServletRequest request) {
        pollService.delete(pollId, request);
        return ApiResponse.success(null);
    }
}
