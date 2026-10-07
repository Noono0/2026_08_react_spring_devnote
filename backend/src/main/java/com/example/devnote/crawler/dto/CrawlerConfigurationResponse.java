package com.example.devnote.crawler.dto;

import java.time.Instant;

/** 저장된 크롤러 설정 응답. request의 로그인 아이디·비밀번호는 저장되지 않으므로 항상 빈 값이다. */
public record CrawlerConfigurationResponse(
    Long configurationId,
    String title,
    String description,
    CrawlerSitePreset sitePreset,
    CrawlerRunRequest request,
    long runCount,
    String lastRunStatus,
    Instant lastRunAt,
    Instant createdAt,
    Instant updatedAt
) {
}
