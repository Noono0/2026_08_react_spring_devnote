package com.example.devnote.diagram.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** diagrams 한 행. 목록 SQL에서는 diagramModel을 읽지 않아 null이고, 상세 SQL에서만 채워진다. */
@Getter
@Setter
public class DiagramRow {
    private Long diagramId;
    private Long memberId;
    private String diagramTitle;
    private String diagramDescription;
    private String diagramType;
    private String diagramModel;
    private Long versionNumber;
    private String useYn;
    private LocalDateTime deletedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
