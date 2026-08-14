package com.example.devnote.member.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MemberPasswordServiceTest {
    @Test
    void encodedPasswordCanBeVerifiedWithoutStoringPlainText() {
        MemberPasswordService passwordService = new MemberPasswordService();
        String encoded = passwordService.encode("admin1234");

        assertThat(encoded).doesNotContain("admin1234");
        assertThat(passwordService.matches("admin1234", encoded)).isTrue();
        assertThat(passwordService.matches("wrong-password", encoded)).isFalse();
    }
}
