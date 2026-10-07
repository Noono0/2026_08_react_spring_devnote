package com.example.devnote.member.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * members 테이블의 "모양"을 Java로 적은 JPA 엔티티입니다.
 *
 * ★ 이 프로젝트의 데이터 읽기·쓰기는 모두 MyBatis(Mapper XML)가 한다. 엔티티는 테이블 구조를 맞추는 용도로만 쓴다.
 *   - 개발(application.yml, ddl-auto: update): 엔티티를 보고 빠진 컬럼을 추가한다.
 *   - 운영(application-prod.yml, validate)   : 테이블이 엔티티와 다르면 서버 시작을 멈춘다.
 *   그래서 schema.sql, 이 엔티티, MemberMapper.xml, MemberRow를 항상 함께 맞춰야 한다.
 *
 * @NoArgsConstructor(access = PROTECTED): JPA는 빈 생성자가 필요하지만, 코드에서 함부로 new 하지 못하게 막는다.
 */
@Getter
@Entity
@Table(name = "members")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MemberEntity {
    @Id
    // IDENTITY: 번호를 DB의 AUTO_INCREMENT가 정한다.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "member_id")
    private Long memberId;

    @Column(nullable = false, unique = true, length = 200)
    private String email;

    // nullable 기본값(true)인 이유: data.sql의 1번 회원은 처음에 login_id가 비어 있고, 서버 시작 시 admin으로 채워진다.
    @Column(name = "login_id", unique = true, length = 100)
    private String loginId;

    @Column(name = "password_hash", length = 500)
    private String passwordHash;

    @Column(name = "member_name", nullable = false, length = 100)
    private String memberName;

    @Column(name = "member_role", nullable = false, length = 30)
    private String memberRole;

    // columnDefinition의 default: ddl-auto update가 컬럼을 다시 만들 때도 DB 기본값('BRONZE')이 사라지지 않게 한다.
    @Column(name = "grade_code", nullable = false, length = 30, columnDefinition = "varchar(30) default 'BRONZE'")
    private String gradeCode;

    @Column(name = "account_status", nullable = false, length = 30, columnDefinition = "varchar(30) default 'ACTIVE'")
    private String accountStatus;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "use_yn", nullable = false, columnDefinition = "char(1) default 'Y'")
    private String useYn;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
