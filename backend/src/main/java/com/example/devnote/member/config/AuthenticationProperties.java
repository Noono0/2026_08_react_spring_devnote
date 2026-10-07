package com.example.devnote.member.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * application.yml의 application.authentication.* 값을 담는 설정 객체입니다.
 *
 * @ConfigurationProperties(prefix = ...): yml의 initial-super-admin-password-hash처럼 "-"로 이은 이름을
 * Java의 initialSuperAdminPasswordHash 필드에 자동으로 맞춰 넣는다(setter를 통해).
 *
 * ★ 기본값은 학습용 계정(admin / admin1234)의 해시다. 외부에 배포하기 전에는
 *   INITIAL_SUPER_ADMIN_PASSWORD_HASH 환경변수로 반드시 다른 해시를 넣는다(docs/deployment.md 5번 절).
 */
@Component
@ConfigurationProperties(prefix = "application.authentication")
public class AuthenticationProperties {
    /** "반복횟수:솔트:해시" 모양의 PBKDF2 해시 문자열(MemberPasswordService.encode가 만드는 형식). 평문 비밀번호가 아니다. */
    private String initialSuperAdminPasswordHash;

    public String getInitialSuperAdminPasswordHash() {
        return initialSuperAdminPasswordHash;
    }

    public void setInitialSuperAdminPasswordHash(String initialSuperAdminPasswordHash) {
        this.initialSuperAdminPasswordHash = initialSuperAdminPasswordHash;
    }
}
