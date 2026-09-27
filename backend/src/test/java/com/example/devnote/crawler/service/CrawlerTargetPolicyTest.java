package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

class CrawlerTargetPolicyTest {
    private final CrawlerTargetPolicy policy = new CrawlerTargetPolicy();

    @Test
    void blocksLocalAndPrivateTargets() {
        assertThatThrownBy(() -> policy.requireAllowedHttpUrl("http://127.0.0.1/admin"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> policy.requireAllowedHttpUrl("http://192.168.0.10/private"))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void blocksCredentialsAndNonStandardPortsInUrl() {
        assertThatThrownBy(() -> policy.requireAllowedHttpUrl("https://user:password@example.com"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> policy.requireAllowedHttpUrl("https://example.com:8443"))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void blocksCrossOriginNavigation() {
        assertThatThrownBy(() -> policy.requireSameOrigin(
            URI.create("https://example.com/list"),
            "https://accounts.example.org/login"
        )).isInstanceOf(BusinessException.class);
    }

    @Test
    void allowsOnlyOfficialNaverLoginForNaverCafe() {
        URI loginUri = policy.requireAllowedLoginUrl(
            URI.create("https://cafe.naver.com/lhuniv9"),
            "https://nid.naver.com/nidlogin.login?mode=form"
        );

        assertThat(loginUri.getHost()).isEqualTo("nid.naver.com");
        assertThatThrownBy(() -> policy.requireAllowedLoginUrl(
            URI.create("https://cafe.naver.com/lhuniv9"),
            "https://example.com/login"
        )).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> policy.requireAllowedLoginUrl(
            URI.create("https://shopping.naver.com/"),
            "https://nid.naver.com/nidlogin.login"
        )).isInstanceOf(BusinessException.class);
    }

    @Test
    void neverFillsCredentialsAfterUnexpectedLoginRedirect() {
        URI startUri = URI.create("https://cafe.naver.com/lhuniv9");
        URI loginUri = URI.create("https://nid.naver.com/nidlogin.login");

        assertThatThrownBy(() -> policy.requireAllowedCredentialPage(
            startUri,
            loginUri,
            "https://www.naver.com/"
        )).isInstanceOf(BusinessException.class);
    }
}
