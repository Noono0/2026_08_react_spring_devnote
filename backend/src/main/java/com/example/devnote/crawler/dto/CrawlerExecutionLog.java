package com.example.devnote.crawler.dto;

import java.time.Instant;

/** 실시간 화면에 보여 줄 실행 기록 한 줄(시각, 단계 이름, 상태, 설명). */
public record CrawlerExecutionLog(Instant time, String step, String status, String message) { }
