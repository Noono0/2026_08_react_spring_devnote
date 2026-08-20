package com.example.devnote.diagram.dto;

import java.time.Instant;

/**
 * 버전 목록/상세 공용 응답.
 * 목록 조회 시에는 diagramModelJson 이 null 로 내려가고,
 * 특정 버전을 열어볼 때만 모델이 채워진다. (목록 응답 크기를 줄이기 위함)
 */
public record DiagramVersionResponse(
    Long diagramVersionId,
    Long diagramId,
    Long versionNumber,
    String diagramTitle,
    DiagramType diagramType,
    String diagramModelJson,
    String changeSummary,
    Instant createdAt
) {
}
