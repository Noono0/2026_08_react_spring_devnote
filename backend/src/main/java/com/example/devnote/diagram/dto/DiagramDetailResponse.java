package com.example.devnote.diagram.dto;

import java.time.Instant;

public record DiagramDetailResponse(
    Long diagramId,
    String diagramTitle,
    String diagramDescription,
    DiagramType diagramType,
    String diagramModelJson,
    Long versionNumber,
    Instant createdAt,
    Instant updatedAt
) {
}
