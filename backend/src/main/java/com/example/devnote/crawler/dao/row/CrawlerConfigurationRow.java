package com.example.devnote.crawler.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

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
