package com.example.devnote.crawler.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 크롤링 결과.
 *   fieldNames : 결과 표의 열 순서
 *   items      : 수집한 항목들. 각 항목은 {열 이름: 값} 모양의 Map이다.
 *   scannedItemCount: 필터 적용 전 살펴본 항목 수(items는 필터를 통과한 것만)
 *   warnings   : 실패는 아니지만 알려 줄 점(다음 페이지 없음, 최대 개수 도달 등)
 */
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
