package com.example.devnote.diagram.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

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
