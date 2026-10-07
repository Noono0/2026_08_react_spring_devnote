package com.example.devnote.crawler.dto;

import java.time.Instant;

/** 실행 이력 상세. 실행 당시 요청(로그인 정보 제외)과 결과 전체를 담는다. 실패했다면 result는 null이고 실패 단계·메시지가 있다. */
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
