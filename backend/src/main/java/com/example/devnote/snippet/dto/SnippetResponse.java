package com.example.devnote.snippet.dto;

import java.time.Instant;
import java.util.List;

/**
 * 코드 조각 응답. DB 컬럼 이름(snippet_title 등) 대신 화면에서 쓰기 쉬운 짧은 이름(title)으로 내보낸다.
 * 시각은 Instant(UTC)로 보내 브라우저가 사용자 시간대로 바꿔 표시한다.
 */
public record SnippetResponse(
    Long snippetId,
    String title,
    String description,
    String language,
    String code,
    List<String> tags,
    boolean favorite,
    boolean deleted,
    Instant createdAt,
    Instant updatedAt,
    Instant deletedAt
) {
}

