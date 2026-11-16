package com.example.devnote.board.todo.controller;

import com.example.devnote.board.todo.dto.TodoDtos.*;
import com.example.devnote.board.todo.service.TodoService;
import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.document.dto.PageResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** 회원은 세션, 비회원은 전용 HttpOnly 쿠키로 소유자를 확인한다. 개발용 회원 헤더는 사용하지 않는다. */
@RestController @RequiredArgsConstructor
@RequestMapping("/api/v1/board-todos")
public class TodoController {
    private final TodoService todoService;
    private final TodoOwnerResolver owners;

    @ModelAttribute
    public void privateResponse(HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "private, no-store");
        response.addHeader(HttpHeaders.VARY, HttpHeaders.COOKIE);
    }
    @GetMapping("/owner")
    public ApiResponse<OwnerView> owner(HttpServletRequest request, HttpServletResponse response) {
        return ApiResponse.success(owners.initialize(request, response));
    }

    @GetMapping("/guest-merge")
    public ApiResponse<GuestMergePreview> previewMerge(HttpServletRequest request) {
        return ApiResponse.success(todoService.previewMerge(owners.requireMember(request), owners.findGuest(request)));
    }

    @PostMapping("/guest-merge")
    public ApiResponse<GuestMergeResult> mergeGuest(@Valid @RequestBody GuestMergeRequest body, HttpServletRequest request) {
        return ApiResponse.success(todoService.mergeGuest(owners.requireMember(request), owners.findGuest(request), body));
    }

    @GetMapping
    public ApiResponse<PageResponse<Todo>> list(@RequestParam(defaultValue = "ALL") String status,
        @RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "0") int pageNumber,
        @RequestParam(defaultValue = "12") int pageSize, HttpServletRequest request) {
        return ApiResponse.success(todoService.list(owners.resolve(request), status, keyword, pageNumber, pageSize));
    }
    @GetMapping("/{todoId}")
    public ApiResponse<Todo> detail(@PathVariable long todoId, HttpServletRequest request) {
        return ApiResponse.success(todoService.detail(owners.resolve(request), todoId));
    }
    @PostMapping
    public ResponseEntity<ApiResponse<Todo>> create(@Valid @RequestBody TodoRequest body, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(todoService.create(owners.resolve(request), body)));
    }
    @PutMapping("/{todoId}")
    public ApiResponse<Todo> update(@PathVariable long todoId, @Valid @RequestBody TodoRequest body, HttpServletRequest request) {
        return ApiResponse.success(todoService.update(owners.resolve(request), todoId, body));
    }
    @DeleteMapping("/{todoId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long todoId, @RequestParam long versionNumber, HttpServletRequest request) {
        todoService.delete(owners.resolve(request), todoId, versionNumber);
    }
}
