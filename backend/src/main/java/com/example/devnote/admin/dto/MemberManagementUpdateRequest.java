package com.example.devnote.admin.dto;

import com.example.devnote.member.dto.MemberGrade;
import com.example.devnote.member.dto.MemberRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * 회원 관리 변경 요청. grade·role은 enum이라 정해진 값만 들어온다.
 * accountStatus는 문자열이라 @Pattern 정규식으로 ACTIVE(정상)·LOCKED(잠금)·WITHDRAWN(탈퇴) 셋만 허용한다.
 */
public record MemberManagementUpdateRequest(
    @NotNull MemberGrade grade,
    @NotNull MemberRole role,
    @NotNull @Pattern(regexp = "ACTIVE|LOCKED|WITHDRAWN") String accountStatus
) {
}
