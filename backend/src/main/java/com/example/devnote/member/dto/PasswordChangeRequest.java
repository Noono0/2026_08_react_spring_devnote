package com.example.devnote.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordChangeRequest(
    @NotBlank @Size(max = 200) String currentPassword,
    @NotBlank @Size(min = 8, max = 200) String newPassword
) {
}
