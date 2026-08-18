package com.example.devnote.diagram.dao.parameter;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DiagramUpdateParameter {
    private final Long diagramId;
    private final Long memberId;
    private final String diagramTitle;
    private final String diagramDescription;
    private final String diagramType;
    private final String diagramModel;
    /**
     * 낙관적 잠금 판정용. UPDATE 의 WHERE 절에 들어가며,
     * 그 사이 다른 요청이 먼저 수정했다면 갱신 건수가 0이 되어 충돌을 감지한다.
     */
    private final Long expectedVersionNumber;
}
