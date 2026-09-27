package com.example.devnote.crawler.dto;

import java.time.Instant;

public record CrawlerExecutionLog(Instant time, String step, String status, String message) { }
