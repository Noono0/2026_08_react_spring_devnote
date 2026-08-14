package com.example.devnote.document.dto;

import java.time.LocalDateTime;

public record DocumentListItemResponse(
    Long documentId,
    String documentTitle,
    String documentStatus,
    Long thumbnailFileId,
    String thumbnailImageUrl,
    Long versionNumber,
    Long viewCount,
    Long authorId,
    String authorName,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
