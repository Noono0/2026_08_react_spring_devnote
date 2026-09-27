package com.example.devnote.crawler.service;

import com.example.devnote.common.exception.GlobalExceptionHandler;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.TimeoutError;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

class CrawlerProgressTest {
    @Test
    void reportsStageAndTimeoutWithoutLeakingPlaywrightInputs() {
        CrawlerProgress progress = new CrawlerProgress();
        progress.at("로그인 비밀번호 입력", "입력칸 선택자를 확인해 주세요.");
        CrawlerFailure failure = progress.failure(new TimeoutError("fill(very-private-password) Timeout 15000ms"));
        var problem = new GlobalExceptionHandler().handleBusinessException(
            failure, new MockHttpServletRequest("POST", "/api/v1/utilities/crawler/run")
        );
        assertThat(problem.getDetail()).contains("대기 시간을 초과").doesNotContain("very-private-password");
        assertThat(problem.getProperties()).containsEntry("crawlerStage", "로그인 비밀번호 입력")
            .containsEntry("suggestedAction", "입력칸 선택자를 확인해 주세요.")
            .containsEntry("errorCode", "CRAWLER_LOGIN_FAILED");
    }

    @Test
    void classifiesNetworkFailureWithoutReturningRawUrlOrTokens() {
        CrawlerFailure failure = new CrawlerProgress().failure(new PlaywrightException(
            "net::ERR_NAME_NOT_RESOLVED https://example.com/?token=private-token"
        ));
        assertThat(failure.getMessage()).contains("DNS").doesNotContain("private-token");
    }
}
