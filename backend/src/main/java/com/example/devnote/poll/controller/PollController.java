package com.example.devnote.poll.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.poll.dto.*;
import com.example.devnote.poll.service.PollService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/polls")
@RequiredArgsConstructor
public class PollController {
    private final PollService pollService;

    @GetMapping
    public ApiResponse<PageResponse<PollResponse>> getPolls(@Valid PollSearchCondition condition, HttpServletRequest request) {
        return ApiResponse.success(pollService.getPolls(condition, request));
    }

    @PostMapping("/{pollId}/votes")
    public ApiResponse<PollResponse> vote(@PathVariable Long pollId, @Valid @RequestBody PollVoteRequest voteRequest, HttpServletRequest request) {
        return ApiResponse.success(pollService.vote(pollId, voteRequest, request));
    }

    @PostMapping
    public ApiResponse<PollResponse> create(@Valid @RequestBody PollCreateRequest createRequest, HttpServletRequest request) {
        return ApiResponse.created(pollService.create(createRequest, request));
    }

    @PutMapping("/{pollId}")
    public ApiResponse<PollResponse> update(@PathVariable Long pollId, @Valid @RequestBody PollCreateRequest updateRequest, HttpServletRequest request) {
        return ApiResponse.success(pollService.update(pollId, updateRequest, request));
    }

    @PutMapping("/{pollId}/status")
    public ApiResponse<PollResponse> updateStatus(@PathVariable Long pollId, @Valid @RequestBody PollStatusUpdateRequest updateRequest, HttpServletRequest request) {
        return ApiResponse.success(pollService.updateStatus(pollId, updateRequest, request));
    }

    @DeleteMapping("/{pollId}")
    public ApiResponse<Void> delete(@PathVariable Long pollId, HttpServletRequest request) {
        pollService.delete(pollId, request);
        return ApiResponse.success(null);
    }
}
