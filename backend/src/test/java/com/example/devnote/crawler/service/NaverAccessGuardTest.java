package com.example.devnote.crawler.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NaverAccessGuardTest {
    @Test
    void stopsWhenCollectionRedirectsToNaverLogin() {
        assertThat(NaverAccessGuard.interruptionReason("https://nid.naver.com/nidlogin.login", "로그인"))
            .hasValueSatisfying(reason -> assertThat(reason).contains("추가 페이지 요청을 중단"));
    }

    @Test
    void stopsWhenNaverShowsAccountProtection() {
        assertThat(NaverAccessGuard.interruptionReason("https://cafe.naver.com/example", "아이디가 보호조치 되었습니다. 보호조치 해제"))
            .hasValueSatisfying(reason -> assertThat(reason).contains("보호조치"));
    }

    @Test
    void ignoresNormalNaverContentAndOtherSites() {
        assertThat(NaverAccessGuard.interruptionReason("https://cafe.naver.com/example", "카페 게시글 본문"))
            .isEmpty();
        assertThat(NaverAccessGuard.interruptionReason("https://example.com", "보호조치 해제"))
            .isEmpty();
    }
}
