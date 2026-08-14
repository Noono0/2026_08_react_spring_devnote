package com.example.devnote.document.dto;

import com.example.devnote.file.dto.DocumentAttachmentResponse;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.List;

public record DocumentDetailResponse(
    Long documentId,
    Long authorId,
    String authorName,
    String documentTitle,
    JsonNode contentJson,
    String contentHtml,
    String contentText,
    Long thumbnailFileId,
    String thumbnailImageUrl,
    List<DocumentAttachmentResponse> attachmentFiles,
    String documentStatus,
    Long versionNumber,
    Long viewCount,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
