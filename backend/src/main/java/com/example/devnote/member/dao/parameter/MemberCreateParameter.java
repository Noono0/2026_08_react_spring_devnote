package com.example.devnote.member.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * 회원 INSERT에 넘기는 값 묶음(DAO 전용). 요청 DTO(RegisterRequest)와 따로 둔 이유:
 * DB에는 평문 비밀번호가 아니라 해시를, 그리고 서버가 정한 역할·등급을 넣어야 하기 때문이다.
 *
 * @Builder: MemberCreateParameter.builder().loginId(...).build() 처럼 이름을 붙여 만들 수 있게 해 준다.
 */
@Getter
@Builder
public class MemberCreateParameter {
    // INSERT 후 DB가 만든 번호(AUTO_INCREMENT)를 MyBatis가 여기에 채워 준다(useGeneratedKeys + keyProperty). 그래서 이 필드만 setter가 있다.
    @Setter private Long memberId;
    private String loginId;
    private String passwordHash;
    private String email;
    private String memberName;
    private String memberRole;
    private String gradeCode;
}
