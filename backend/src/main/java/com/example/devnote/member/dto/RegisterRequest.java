package com.example.devnote.member.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Size(min = 4, max = 100) String loginId,
    @NotBlank @Size(min = 8, max = 200) String password,
    @NotBlank @Size(max = 100) String memberName,
    @NotBlank @Email @Size(max = 200) String email
) {
}
