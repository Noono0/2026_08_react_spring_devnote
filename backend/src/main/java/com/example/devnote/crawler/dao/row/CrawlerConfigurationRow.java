package com.example.devnote.crawler.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** 설정 한 행 + 실행 요약(실행 횟수, 마지막 실행 상태·시각 — SQL의 하위 조회로 계산). */
@Getter
@Setter
public class CrawlerConfigurationRow {
    private Long crawlerConfigurationId;
    private String configurationTitle;
    private String configurationDescription;
    private String sitePreset;
    private String requestJson;
    private long runCount;
    private String lastRunStatus;
    private LocalDateTime lastRunAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
