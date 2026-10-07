package com.example.devnote.crawler.dto;

import java.time.Instant;

/** 저장된 네이버 로그인 세션이 있는지와 마지막 저장 시각. 세션 내용(쿠키)은 절대 응답에 넣지 않는다. */
public record CrawlerSessionStatusResponse(boolean available, Instant updatedAt) {
}
