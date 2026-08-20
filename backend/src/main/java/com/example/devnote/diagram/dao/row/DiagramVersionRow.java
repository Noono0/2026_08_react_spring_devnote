package com.example.devnote.diagram.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

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
