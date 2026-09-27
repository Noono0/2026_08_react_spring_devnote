package com.example.devnote.crawler.dto;

import java.time.Instant;

public record CrawlerRunHistoryDetailResponse(
    Long historyId,
    Long configurationId,
    String status,
    CrawlerRunRequest request,
    CrawlerRunResponse result,
    String failureStage,
    String failureMessage,
    long durationMillis,
    int itemCount,
    Instant startedAt,
    Instant completedAt
) {
}
