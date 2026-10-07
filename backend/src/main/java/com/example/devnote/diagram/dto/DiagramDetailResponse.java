package com.example.devnote.diagram.dto;

import java.time.Instant;

/**
 * 다이어그램 상세 응답. diagramModelJson은 문자열 그대로 보내고, 프론트(diagramModel.ts의 parseDiagramModel)가 해석하고, 모양이 이상하면 빈 다이어그램으로 시작한다.
 * versionNumber는 다음 저장 요청에 다시 실어 보내야 한다(낙관적 잠금).
 */
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
