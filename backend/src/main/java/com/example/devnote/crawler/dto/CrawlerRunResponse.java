package com.example.devnote.crawler.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record CrawlerRunResponse(
    Instant crawledAt,
    String pageTitle,
    String finalUrl,
    int crawledPageCount,
    int scannedItemCount,
    long durationMillis,
    List<String> fieldNames,
    List<Map<String, String>> items,
    List<String> warnings
) {
}
