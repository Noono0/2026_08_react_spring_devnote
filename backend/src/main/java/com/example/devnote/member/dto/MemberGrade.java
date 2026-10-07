package com.example.devnote.member.dto;

/**
 * 회원 등급(낮음 → 높음 순). DB에는 이름 문자열("BRONZE")로 저장된다.
 * 새 회원은 BRONZE로 시작하고, 관리자 화면에서 바꿀 수 있다. 등급 표시 이름은 member_grades 테이블에서 관리한다.
 */
public enum MemberGrade {
    BRONZE,
    SILVER,
    GOLD,
    PLATINUM,
    DIAMOND
}
