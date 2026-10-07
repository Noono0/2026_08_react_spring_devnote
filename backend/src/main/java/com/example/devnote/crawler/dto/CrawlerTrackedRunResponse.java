package com.example.devnote.crawler.dto;

/** 저장된 설정으로 실행한 결과 + 그 실행의 이력 번호(화면이 이력 상세로 바로 이동할 수 있게). */
public record CrawlerTrackedRunResponse(
    Long historyId,
    CrawlerRunResponse result
) {
}
