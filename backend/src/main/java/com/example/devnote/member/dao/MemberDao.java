package com.example.devnote.member.dao;

import com.example.devnote.member.dao.parameter.MemberCreateParameter;
import com.example.devnote.member.dao.row.MemberRow;

import java.util.List;

/**
 * 회원(members 테이블) 조회·저장 약속(인터페이스)입니다.
 * Service는 이 인터페이스만 알고, 실제 SQL 실행은 MemberDaoImpl → MemberMapper.xml이 맡는다.
 * (인터페이스로 나눠 두면 테스트에서 가짜 구현으로 바꾸기 쉽다)
 */
public interface MemberDao {
    // select…By…: 사용 중(use_yn = 'Y')인 회원 한 명. 없으면 null.
    MemberRow selectMemberByLoginId(String loginId);
    MemberRow selectMemberByEmail(String email);
    MemberRow selectMemberById(Long memberId);
    // 관리자 화면용 전체 목록(삭제 표시된 회원 포함).
    List<MemberRow> selectAllMembers();
    void insertMember(MemberCreateParameter parameter);
    void updateLastLoginAt(Long memberId);
    // 관리자가 등급·역할·계정 상태를 바꾼다. 돌려주는 int = 실제로 바뀐 행 수(0이면 대상 회원 없음).
    int updateMemberManagement(Long memberId, String gradeCode, String memberRole, String accountStatus);
    void upsertSuperAdministrator(String passwordHash);
}
