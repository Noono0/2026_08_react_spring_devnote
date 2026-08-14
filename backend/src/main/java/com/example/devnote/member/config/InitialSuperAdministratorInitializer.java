package com.example.devnote.member.config;

import com.example.devnote.member.dao.MemberDao;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

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
