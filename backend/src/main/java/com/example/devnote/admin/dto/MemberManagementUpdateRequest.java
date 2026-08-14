package com.example.devnote.admin.dto;

import com.example.devnote.member.dto.MemberGrade;
import com.example.devnote.member.dto.MemberRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record MemberManagementUpdateRequest(
    @NotNull MemberGrade grade,
    @NotNull MemberRole role,
    @NotNull @Pattern(regexp = "ACTIVE|LOCKED|WITHDRAWN") String accountStatus
) {
}
