package com.example.devnote.admin.dto;

import java.time.LocalDateTime;

/** 관리자 화면의 회원 한 줄. MemberRow에서 비밀번호 해시를 뺀 값만 담는다. */
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
