package com.example.devnote.member.dao;

import com.example.devnote.member.dao.parameter.MemberCreateParameter;
import com.example.devnote.member.dao.row.MemberRow;

import java.util.List;

public interface MemberDao {
    MemberRow selectMemberByLoginId(String loginId);
    MemberRow selectMemberByEmail(String email);
    MemberRow selectMemberById(Long memberId);
    List<MemberRow> selectAllMembers();
    void insertMember(MemberCreateParameter parameter);
    void updateLastLoginAt(Long memberId);
    int updateMemberManagement(Long memberId, String gradeCode, String memberRole, String accountStatus);
    void upsertSuperAdministrator(String passwordHash);
}
