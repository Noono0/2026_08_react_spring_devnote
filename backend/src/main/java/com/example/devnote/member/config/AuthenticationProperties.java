package com.example.devnote.member.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "application.authentication")
public class AuthenticationProperties {
    private String initialSuperAdminPasswordHash;

    public String getInitialSuperAdminPasswordHash() {
        return initialSuperAdminPasswordHash;
    }

    public void setInitialSuperAdminPasswordHash(String initialSuperAdminPasswordHash) {
        this.initialSuperAdminPasswordHash = initialSuperAdminPasswordHash;
    }
}
