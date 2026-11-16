package com.example.devnote.board.todo.controller;

import com.example.devnote.board.todo.dto.TodoPushDtos.*;
import com.example.devnote.board.todo.service.TodoPushService;
import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/v1/board-todos/push")
public class TodoPushController {
    private final TodoPushService push;
    private final TodoPushDeviceCookie devices;
    private final TodoOwnerResolver owners;
    @ModelAttribute
    public void noCache(HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "private, no-store"); response.addHeader(HttpHeaders.VARY, HttpHeaders.COOKIE);
    }
    @GetMapping
    public ApiResponse<Settings> settings(HttpServletRequest request, HttpServletResponse response) {
        return ApiResponse.success(push.settings(owners.resolve(request), devices.initialize(request, response)));
    }
    @PostMapping("/subscription") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(@Valid @RequestBody SubscriptionRequest body, HttpServletRequest request) {
        var owner = owners.resolve(request);
        String actualKey = owner.memberId() != null ? "member:" + owner.memberId() : "guest:" + owners.findGuest(request).getPublicId();
        if (!actualKey.equals(body.expectedOwnerKey())) throw new BusinessException(ErrorCode.TODO_PUSH_CONTEXT_CHANGED);
        push.subscribe(owner, devices.deviceHash(request), body);
    }
    @DeleteMapping("/subscription") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unsubscribe(@RequestParam String expectedOwnerKey, HttpServletRequest request) {
        var owner = owners.resolve(request);
        String actualKey = owner.memberId() != null ? "member:" + owner.memberId() : "guest:" + owners.findGuest(request).getPublicId();
        if (!actualKey.equals(expectedOwnerKey)) throw new BusinessException(ErrorCode.TODO_PUSH_CONTEXT_CHANGED);
        push.disableDevice(devices.deviceHash(request));
    }
}
