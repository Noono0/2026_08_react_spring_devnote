package com.example.devnote.crawler.dto;

import java.time.Instant;

public record CrawlerSessionStatusResponse(boolean available, Instant updatedAt) {
}
