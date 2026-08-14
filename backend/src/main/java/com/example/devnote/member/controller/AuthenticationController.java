package com.example.devnote.member.controller;

import com.example.devnote.common.api.ApiResponse;
import com.example.devnote.member.dto.AuthSessionResponse;
import com.example.devnote.member.dto.LoginRequest;
import com.example.devnote.member.dto.RegisterRequest;
import com.example.devnote.member.service.AuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthenticationController {
    private final AuthenticationService authenticationService;

    @PostMapping("/login")
    public ApiResponse<AuthSessionResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        return ApiResponse.success(authenticationService.login(request, servletRequest, servletResponse));
    }

    @PostMapping("/register")
    public ApiResponse<AuthSessionResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest servletRequest) {
        return ApiResponse.created(authenticationService.register(request, servletRequest));
    }

    @GetMapping("/session")
    public ApiResponse<AuthSessionResponse> getSession(HttpServletRequest request) {
        return ApiResponse.success(authenticationService.getSession(request));
    }

    @DeleteMapping("/session")
    public ApiResponse<AuthSessionResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        authenticationService.logout(request, response);
        return ApiResponse.success(AuthSessionResponse.guest());
    }
}
