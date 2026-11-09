package com.example.devnote.member.dto;

import com.example.devnote.member.dao.row.MemberRow;

import java.time.LocalDateTime;

/** 비밀번호 해시를 제외한 회원 상세정보. */
public record MemberDetailResponse(
    Long memberId,
    String loginId,
    String email,
    String memberName,
    String memberRole,
    String gradeCode,
    String accountStatus,
    String useYn,
    LocalDateTime lastLoginAt,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static MemberDetailResponse from(MemberRow member) {
        return new MemberDetailResponse(member.getMemberId(), member.getLoginId(), member.getEmail(), member.getMemberName(),
            member.getMemberRole(), member.getGradeCode(), member.getAccountStatus(), member.getUseYn(),
            member.getLastLoginAt(), member.getCreatedAt(), member.getUpdatedAt());
    }
}
