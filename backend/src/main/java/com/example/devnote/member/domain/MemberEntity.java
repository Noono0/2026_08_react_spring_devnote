package com.example.devnote.member.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "members")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MemberEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "member_id")
    private Long memberId;

    @Column(nullable = false, unique = true, length = 200)
    private String email;

    @Column(name = "login_id", unique = true, length = 100)
    private String loginId;

    @Column(name = "password_hash", length = 500)
    private String passwordHash;

    @Column(name = "member_name", nullable = false, length = 100)
    private String memberName;

    @Column(name = "member_role", nullable = false, length = 30)
    private String memberRole;

    @Column(name = "grade_code", nullable = false, length = 30, columnDefinition = "varchar(30) default 'BRONZE'")
    private String gradeCode;

    @Column(name = "account_status", nullable = false, length = 30, columnDefinition = "varchar(30) default 'ACTIVE'")
    private String accountStatus;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "use_yn", nullable = false, columnDefinition = "char(1)")
    private String useYn;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
