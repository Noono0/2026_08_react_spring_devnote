package com.example.devnote.member.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * members 테이블 한 행을 그대로 담는 객체(DAO → Service 전달용).
 * MyBatis가 SELECT 결과의 컬럼(member_id)을 필드(memberId)에 자동으로 넣는다(map-underscore-to-camel-case 설정).
 * ★ passwordHash가 들어 있으므로 이 객체를 API 응답으로 그대로 내보내지 않는다. 응답은 AuthSessionResponse 등으로 바꿔서 보낸다.
 */
@Getter
@Setter
public class MemberRow {
    private Long memberId;
    private String loginId;
    private String passwordHash;
    private String email;
    private String memberName;
    // 문자열로 저장된 값: memberRole = USER/ADMIN/SUPER_ADMIN, gradeCode = BRONZE~DIAMOND, accountStatus = ACTIVE 등
    private String memberRole;
    private String gradeCode;
    private String accountStatus;
    // 'Y' = 사용 중, 'N' = 삭제 표시(행을 지우지 않고 표시만 바꾸는 "논리 삭제")
    private String useYn;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
