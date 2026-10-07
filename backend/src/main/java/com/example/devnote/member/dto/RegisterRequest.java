package com.example.devnote.member.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 회원가입 요청 본문. 아이디 4자 이상, 비밀번호 8자 이상, 이메일 형식(@Email)을 서버에서도 검사한다.
 * (프론트 폼도 같은 규칙을 검사하지만, 요청은 화면을 거치지 않고도 보낼 수 있으므로 서버 검사가 최종 기준이다)
 */
public record RegisterRequest(
    @NotBlank @Size(min = 4, max = 100) String loginId,
    @NotBlank @Size(min = 8, max = 200) String password,
    @NotBlank @Size(max = 100) String memberName,
    @NotBlank @Email @Size(max = 200) String email
) {
}
