package com.example.devnote.diagram.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** diagram_versions 한 행. 버전 목록에서는 diagramModel이 비어 있고, 특정 버전 조회에서만 채워진다. */
@Getter
@Setter
public class DiagramVersionRow {
    private Long diagramVersionId;
    private Long diagramId;
    private Long versionNumber;
    private String diagramTitle;
    private String diagramType;
    private String diagramModel;
    private String changeSummary;
    private Long changedBy;
    private LocalDateTime createdAt;
}
