package com.example.devnote.member.dto;

/**
 * 회원 역할. USER = 일반 회원, ADMIN = 관리자, SUPER_ADMIN = 슈퍼관리자(회원 관리·권한 변경 가능).
 * enum에 메서드를 넣으면 "역할에 대한 판단"을 한곳에 모을 수 있다(여기저기서 == 비교를 반복하지 않는다).
 */
public enum MemberRole {
    USER,
    ADMIN,
    SUPER_ADMIN;

    /** 관리자 메뉴를 볼 수 있는 역할인가? (ADMIN과 SUPER_ADMIN 모두 해당) */
    public boolean isAdministrator() {
        return this == ADMIN || this == SUPER_ADMIN;
    }
}
