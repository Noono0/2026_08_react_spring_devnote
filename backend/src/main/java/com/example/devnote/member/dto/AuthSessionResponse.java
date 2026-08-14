package com.example.devnote.member.dto;

public record AuthSessionResponse(
    boolean authenticated,
    Long memberId,
    String loginId,
    String memberName,
    String email,
    MemberGrade grade,
    MemberRole role,
    boolean administrator,
    boolean superAdministrator
) {
    public static AuthSessionResponse guest() {
        return new AuthSessionResponse(false, null, null, "비회원", null, null, null, false, false);
    }
}
