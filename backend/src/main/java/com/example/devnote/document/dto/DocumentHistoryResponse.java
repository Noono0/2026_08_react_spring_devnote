package com.example.devnote.document.dto;

import java.time.LocalDateTime;

public record DocumentHistoryResponse(
    Long documentHistoryId,
    Long documentId,
    Long versionNumber,
    String documentTitle,
    String changeSummary,
    Long changedBy,
    String changedByName,
    LocalDateTime createdAt
) {
}
