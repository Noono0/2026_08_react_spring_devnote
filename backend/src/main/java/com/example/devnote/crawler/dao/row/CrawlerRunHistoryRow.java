package com.example.devnote.crawler.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 실행 이력 한 행. runStatus = RUNNING / SUCCESS / FAILURE.
 * 목록 SQL은 큰 JSON(requestJson·resultJson)을 읽지 않아 null이고, 상세 SQL에서만 채워진다.
 */
@Getter
@Setter
public class CrawlerRunHistoryRow {
    private Long crawlerRunHistoryId;
    private Long crawlerConfigurationId;
    private String runStatus;
    private String requestJson;
    private String resultJson;
    private String failureStage;
    private String failureMessage;
    private long durationMillis;
    private int itemCount;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
}
