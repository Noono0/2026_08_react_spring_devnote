package com.example.devnote.member.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MemberProfileUpdateRequest(
    @NotBlank @Size(max = 100) String memberName,
    @NotBlank @Email @Size(max = 200) String email
) {
}
