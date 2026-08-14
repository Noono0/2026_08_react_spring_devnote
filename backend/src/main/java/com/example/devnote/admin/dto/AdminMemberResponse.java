package com.example.devnote.admin.dto;

import java.time.LocalDateTime;

public record AdminMemberResponse(
    Long memberId,
    String loginId,
    String email,
    String memberName,
    String memberRole,
    String gradeCode,
    String accountStatus,
    LocalDateTime lastLoginAt,
    LocalDateTime createdAt
) {
}
