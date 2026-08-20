package com.example.devnote.diagram.dto;

import java.time.Instant;

/**
 * 목록 화면용 요약 정보.
 * 모델 JSON이 빠져 있는 점이 중요하다. 목록에서 수십 개의 모델을 함께 내려보내면
 * 응답이 급격히 커지므로 상세 조회에서만 모델을 전달한다.
 */
public record DiagramListItemResponse(
    Long diagramId,
    String diagramTitle,
    String diagramDescription,
    DiagramType diagramType,
    Long versionNumber,
    Instant createdAt,
    Instant updatedAt
) {
}
