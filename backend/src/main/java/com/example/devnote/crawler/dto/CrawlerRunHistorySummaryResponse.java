package com.example.devnote.crawler.dto;

import java.time.Instant;

public record CrawlerRunHistorySummaryResponse(
    Long historyId,
    Long configurationId,
    String status,
    String failureStage,
    String failureMessage,
    long durationMillis,
    int itemCount,
    Instant startedAt,
    Instant completedAt
) {
}
