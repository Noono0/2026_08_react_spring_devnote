package com.example.devnote.crawler.dto;

import java.time.Instant;

/** 실행 이력 목록의 한 줄(요청·결과 JSON 없이 상태·걸린 시간·수집 건수만). */
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
