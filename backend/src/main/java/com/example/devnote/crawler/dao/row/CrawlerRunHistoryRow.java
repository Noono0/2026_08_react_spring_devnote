package com.example.devnote.crawler.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

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
