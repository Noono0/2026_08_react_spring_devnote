package com.example.devnote.diagram.dao;

import com.example.devnote.diagram.dao.parameter.DiagramCreateParameter;
import com.example.devnote.diagram.dao.parameter.DiagramUpdateParameter;
import com.example.devnote.diagram.dao.parameter.DiagramVersionCreateParameter;
import com.example.devnote.diagram.dao.row.DiagramRow;
import com.example.devnote.diagram.dao.row.DiagramVersionRow;
import com.example.devnote.diagram.dto.DiagramSearchCondition;

import java.util.List;

public interface DiagramDao {
    List<DiagramRow> selectDiagrams(Long memberId, DiagramSearchCondition condition);

    long countDiagrams(Long memberId, DiagramSearchCondition condition);

    /** 소유자 조건을 함께 걸어 남의 다이어그램을 조회할 수 없게 한다. */
    DiagramRow selectDiagram(Long diagramId, Long memberId);

    void insertDiagram(DiagramCreateParameter parameter);

    /** 낙관적 잠금 때문에 갱신 건수를 반환한다. 0이면 버전 충돌이다. */
    int updateDiagram(DiagramUpdateParameter parameter);

    int softDeleteDiagram(Long diagramId, Long memberId);

    void insertDiagramVersion(DiagramVersionCreateParameter parameter);

    List<DiagramVersionRow> selectDiagramVersions(Long diagramId);

    DiagramVersionRow selectDiagramVersion(Long diagramId, Long versionNumber);

    /** 보관 개수를 넘어선 오래된 이력을 정리한다. (저사양 서버의 저장 공간 보호) */
    int deleteOldDiagramVersions(Long diagramId, int keepCount);
}
