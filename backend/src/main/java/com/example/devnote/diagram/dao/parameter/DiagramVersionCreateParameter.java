package com.example.devnote.diagram.dao.parameter;

import lombok.Builder;
import lombok.Getter;

/** 버전 이력 INSERT용 값. 저장 "후"의 내용을 새 버전 번호로 남긴다(문서 이력과 달리 수정 후 스냅샷). */
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
