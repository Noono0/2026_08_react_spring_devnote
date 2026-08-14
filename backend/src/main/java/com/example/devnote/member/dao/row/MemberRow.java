package com.example.devnote.member.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class MemberRow {
    private Long memberId;
    private String loginId;
    private String passwordHash;
    private String email;
    private String memberName;
    private String memberRole;
    private String gradeCode;
    private String accountStatus;
    private String useYn;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
