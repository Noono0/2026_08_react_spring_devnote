package com.example.devnote.member.dao;

import com.example.devnote.member.dao.parameter.MemberCreateParameter;
import com.example.devnote.member.dao.row.MemberRow;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

/**
 * MemberDao의 실제 구현. MyBatis의 SqlSessionTemplate으로 Mapper XML의 SQL을 실행합니다.
 *
 * [SQL을 찾는 방법]  NAMESPACE + "selectMemberByLoginId"
 *   = MemberMapper.xml의 <mapper namespace="com.example.devnote.member.MemberMapper"> 안의 <select id="selectMemberByLoginId">
 *
 * selectOne : 결과가 0~1건일 때(0건이면 null, 2건 이상이면 예외)
 * selectList: 여러 건(0건이면 빈 리스트)
 * insert/update: 영향받은 행 수를 돌려준다.
 * @Repository: DB 예외를 Spring의 공통 예외(DataAccessException, 예: DuplicateKeyException)로 바꿔 준다.
 */
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
        // 파라미터가 여러 개라 Map에 이름을 붙여 넘긴다. XML에서 #{memberId}, #{gradeCode}처럼 이 이름으로 꺼낸다.
        return sqlSessionTemplate.update(NAMESPACE + "updateMemberManagement", Map.of("memberId", memberId, "gradeCode", gradeCode, "memberRole", memberRole, "accountStatus", accountStatus));
    }
    @Override public void upsertSuperAdministrator(String passwordHash) { sqlSessionTemplate.update(NAMESPACE + "upsertSuperAdministrator", passwordHash); }
}
