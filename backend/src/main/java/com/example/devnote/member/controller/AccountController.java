package com.example.devnote.member.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.member.dto.MemberDetailResponse;
import com.example.devnote.member.dto.MemberProfileUpdateRequest;
import com.example.devnote.member.dto.PasswordChangeRequest;
import com.example.devnote.member.service.MemberProfileService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** 로그인한 회원의 자기 정보와 비밀번호. */
@RestController
@RequestMapping("/api/v1/account")
@RequiredArgsConstructor
public class AccountController {
    private final MemberProfileService memberProfileService;

    @GetMapping
    public ApiResponse<MemberDetailResponse> getOwnProfile(HttpServletRequest request) {
        return ApiResponse.success(memberProfileService.getOwnProfile(request));
    }

    @PutMapping
    public ApiResponse<MemberDetailResponse> updateOwnProfile(@Valid @RequestBody MemberProfileUpdateRequest updateRequest, HttpServletRequest request) {
        return ApiResponse.success(memberProfileService.updateOwnProfile(updateRequest, request));
    }

    @PutMapping("/password")
    public ApiResponse<Void> changeOwnPassword(@Valid @RequestBody PasswordChangeRequest changeRequest, HttpServletRequest request) {
        memberProfileService.changeOwnPassword(changeRequest, request);
        return ApiResponse.success(null);
    }
}
