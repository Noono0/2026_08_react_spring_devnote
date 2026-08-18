package com.example.devnote.diagram.dao.parameter;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DiagramCreateParameter {
    /** insert 후 MyBatis useGeneratedKeys 로 채워진다. */
    private Long diagramId;
    private final Long memberId;
    private final String diagramTitle;
    private final String diagramDescription;
    private final String diagramType;
    private final String diagramModel;

    public void setDiagramId(Long diagramId) {
        this.diagramId = diagramId;
    }
}
