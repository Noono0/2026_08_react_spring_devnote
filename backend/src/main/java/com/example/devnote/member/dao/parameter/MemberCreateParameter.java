package com.example.devnote.member.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Builder
public class MemberCreateParameter {
    @Setter private Long memberId;
    private String loginId;
    private String passwordHash;
    private String email;
    private String memberName;
    private String memberRole;
    private String gradeCode;
}
