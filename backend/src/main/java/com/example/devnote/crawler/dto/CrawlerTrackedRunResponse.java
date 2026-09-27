package com.example.devnote.crawler.dto;

public record CrawlerTrackedRunResponse(
    Long historyId,
    CrawlerRunResponse result
) {
}
