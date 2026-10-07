package com.example.devnote.member.config;

import com.example.devnote.member.dao.MemberDao;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 서버가 켜질 때 한 번, 슈퍼관리자 계정(admin)을 준비합니다.
 *
 * ApplicationRunner: 모든 Bean이 만들어지고 서버가 요청을 받기 직전에 run()이 자동으로 실행된다.
 *
 * [동작] MemberMapper.xml의 upsertSuperAdministrator 참고
 *   data.sql이 만든 1번 회원의 login_id가 아직 비어 있을 때만 admin 계정으로 채운다.
 *   이미 채워져 있으면 아무것도 바꾸지 않으므로, 관리자가 바꾼 정보를 재시작 때마다 덮어쓰지 않는다.
 */
@Component
@RequiredArgsConstructor
public class InitialSuperAdministratorInitializer implements ApplicationRunner {
    private final MemberDao memberDao;
    private final AuthenticationProperties properties;

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        memberDao.upsertSuperAdministrator(properties.getInitialSuperAdminPasswordHash());
    }
}
