package com.example.devnote.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
    @NotBlank @Size(max = 100) String loginId,
    @NotBlank @Size(max = 200) String password,
    boolean autoLogin
) {
}
