package com.example.devnote.diagram.dao.parameter;

import lombok.Builder;
import lombok.Getter;

/**
 * 다이어그램 INSERT용 값. diagramModel은 편집기가 만든 JSON 문자열을 그대로 담는다.
 * 다른 필드는 final(한 번 정하면 못 바꿈)이고, DB가 만든 번호를 받기 위해 diagramId에만 setter를 직접 만들었다.
 */
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
