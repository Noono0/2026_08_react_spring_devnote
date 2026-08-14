package com.example.devnote.snippet.dto;

import java.time.Instant;
import java.util.List;

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

