package com.example.devnote.diagram.dao.parameter;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DiagramVersionCreateParameter {
    private final Long diagramId;
    private final Long versionNumber;
    private final String diagramTitle;
    private final String diagramType;
    private final String diagramModel;
    private final String changeSummary;
    private final Long changedBy;
}
