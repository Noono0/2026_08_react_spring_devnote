package com.example.devnote.crawler.dto;

import java.time.Instant;

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
