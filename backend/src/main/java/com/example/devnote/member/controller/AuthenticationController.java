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

/**
 * 로그인·회원가입·로그아웃 API입니다. (/api/v1/auth)
 *
 * Controller는 요청을 받아 Service에 넘기고 결과를 ApiResponse로 감싸는 일만 한다.
 * 세션·쿠키 같은 실제 처리는 AuthenticationService가 맡는다.
 *
 * HttpServletRequest/Response를 파라미터로 받는 이유: 세션을 만들고(request.getSession) 쿠키를 응답 헤더에 써야(response) 하기 때문.
 * @Valid: LoginRequest·RegisterRequest의 @NotBlank·@Size 검사를 실행한다. 실패하면 GlobalExceptionHandler가 400으로 바꾼다.
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthenticationController {
    private final AuthenticationService authenticationService;

    // POST /api/v1/auth/login → 성공하면 Set-Cookie로 세션 쿠키가 내려가고, 로그인한 회원 정보가 응답된다.
    @PostMapping("/login")
    public ApiResponse<AuthSessionResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        return ApiResponse.success(authenticationService.login(request, servletRequest, servletResponse));
    }

    // POST /api/v1/auth/register → 새 회원을 만들고 곧바로 로그인 상태로 만든다(201 Created).
    @PostMapping("/register")
    public ApiResponse<AuthSessionResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest servletRequest) {
        return ApiResponse.created(authenticationService.register(request, servletRequest));
    }

    // GET /api/v1/auth/session → 새로고침 후 "지금 로그인돼 있나?"를 묻는 API. 로그인 안 했으면 오류가 아니라 비회원(guest) 정보를 준다.
    @GetMapping("/session")
    public ApiResponse<AuthSessionResponse> getSession(HttpServletRequest request) {
        return ApiResponse.success(authenticationService.getSession(request));
    }

    // DELETE /api/v1/auth/session → 로그아웃. "세션을 지운다"는 뜻으로 DELETE 메서드를 쓴다.
    @DeleteMapping("/session")
    public ApiResponse<AuthSessionResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        authenticationService.logout(request, response);
        return ApiResponse.success(AuthSessionResponse.guest());
    }
}
