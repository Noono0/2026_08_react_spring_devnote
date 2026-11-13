package com.example.devnote.board.controller;

import com.example.devnote.board.dto.BoardDtos.*;
import com.example.devnote.board.service.BoardService;
import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.document.dto.PageResponse;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import com.example.devnote.member.service.CurrentMemberProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.YearMonth;

/** 분류형 통합 목록과 에디터·팝업 게시판을 연결하는 학습용 API. */
@RestController
@RequestMapping("/api/v1/boards/{boardType}/posts")
@RequiredArgsConstructor
public class BoardController {
    private final BoardService boardService;
    private final CurrentMemberProvider currentMemberProvider;
    private final AuthenticationService authenticationService;

    @GetMapping
    public ApiResponse<PageResponse<PostSummary>> list(@PathVariable String boardType,
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String category,
        @RequestParam(defaultValue = "0") int pageNumber,
        @RequestParam(defaultValue = "12") int pageSize, HttpServletRequest request) {
        if ("COMMUNITY".equalsIgnoreCase(boardType)) {
            return ApiResponse.success(boardService.listCommunity(category, keyword, pageNumber, pageSize));
        }
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        return ApiResponse.success(boardService.list(boardService.parseType(boardType), keyword, pageNumber, pageSize,
            member == null ? null : member.getMemberId()));
    }

    @GetMapping("/active")
    public ApiResponse<java.util.List<ActivePopup>> active(@PathVariable String boardType, @RequestParam String path) {
        return ApiResponse.success(boardService.activePopups(boardService.parseType(boardType), path));
    }

    @GetMapping("/calendar")
    public ApiResponse<CalendarMonthResponse> calendar(@PathVariable String boardType,
        @RequestParam String month, @RequestParam(defaultValue = "") String keyword) {
        YearMonth parsedMonth = boardService.parseMonth(month);
        return ApiResponse.success(boardService.calendarMonth(boardService.parseType(boardType), parsedMonth, keyword));
    }

    @GetMapping("/{postId}")
    public ApiResponse<PostDetail> detail(@PathVariable String boardType, @PathVariable long postId, HttpServletRequest request) {
        MemberRow member = authenticationService.findAuthenticatedMember(request);
        return ApiResponse.success(boardService.detail(boardService.parseType(boardType), postId, member == null ? null : member.getMemberId()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PostDetail>> create(@PathVariable String boardType,
        @Valid @RequestBody PostRequest body, HttpServletRequest request) {
        PostDetail result = boardService.create(boardService.parseType(boardType), body, currentMemberProvider.getCurrentMemberId(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(result));
    }

    @PutMapping("/{postId}")
    public ApiResponse<PostDetail> update(@PathVariable String boardType, @PathVariable long postId,
        @Valid @RequestBody PostRequest body, HttpServletRequest request) {
        return ApiResponse.success(boardService.update(boardService.parseType(boardType), postId, body,
            currentMemberProvider.getCurrentMemberId(request)));
    }

    @DeleteMapping("/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String boardType, @PathVariable long postId, HttpServletRequest request) {
        boardService.delete(boardService.parseType(boardType), postId, currentMemberProvider.getCurrentMemberId(request));
    }

    @PostMapping("/{postId}/answer")
    public ApiResponse<PostDetail> answer(@PathVariable String boardType, @PathVariable long postId,
        @Valid @RequestBody AnswerRequest body, HttpServletRequest request) {
        return ApiResponse.success(boardService.answer(boardService.parseType(boardType), postId, body,
            currentMemberProvider.getCurrentMemberId(request)));
    }

    @DeleteMapping("/{postId}/answer")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAnswer(@PathVariable String boardType, @PathVariable long postId, HttpServletRequest request) {
        boardService.deleteAnswer(boardService.parseType(boardType), postId, currentMemberProvider.getCurrentMemberId(request));
    }
}
