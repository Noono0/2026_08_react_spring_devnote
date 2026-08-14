package com.example.devnote.member.dao;

import com.example.devnote.member.dao.parameter.MemberCreateParameter;
import com.example.devnote.member.dao.row.MemberRow;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class MemberDaoImpl implements MemberDao {
    private static final String NAMESPACE = "com.example.devnote.member.MemberMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    @Override public MemberRow selectMemberByLoginId(String loginId) { return sqlSessionTemplate.selectOne(NAMESPACE + "selectMemberByLoginId", loginId); }
    @Override public MemberRow selectMemberByEmail(String email) { return sqlSessionTemplate.selectOne(NAMESPACE + "selectMemberByEmail", email); }
    @Override public MemberRow selectMemberById(Long memberId) { return sqlSessionTemplate.selectOne(NAMESPACE + "selectMemberById", memberId); }
    @Override public List<MemberRow> selectAllMembers() { return sqlSessionTemplate.selectList(NAMESPACE + "selectAllMembers"); }
    @Override public void insertMember(MemberCreateParameter parameter) { sqlSessionTemplate.insert(NAMESPACE + "insertMember", parameter); }
    @Override public void updateLastLoginAt(Long memberId) { sqlSessionTemplate.update(NAMESPACE + "updateLastLoginAt", memberId); }
    @Override public int updateMemberManagement(Long memberId, String gradeCode, String memberRole, String accountStatus) {
        return sqlSessionTemplate.update(NAMESPACE + "updateMemberManagement", Map.of("memberId", memberId, "gradeCode", gradeCode, "memberRole", memberRole, "accountStatus", accountStatus));
    }
    @Override public void upsertSuperAdministrator(String passwordHash) { sqlSessionTemplate.update(NAMESPACE + "upsertSuperAdministrator", passwordHash); }
}
