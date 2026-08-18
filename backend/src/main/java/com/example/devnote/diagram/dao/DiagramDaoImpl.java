package com.example.devnote.diagram.dao;

import com.example.devnote.diagram.dao.parameter.DiagramCreateParameter;
import com.example.devnote.diagram.dao.parameter.DiagramUpdateParameter;
import com.example.devnote.diagram.dao.parameter.DiagramVersionCreateParameter;
import com.example.devnote.diagram.dao.row.DiagramRow;
import com.example.devnote.diagram.dao.row.DiagramVersionRow;
import com.example.devnote.diagram.dto.DiagramSearchCondition;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class DiagramDaoImpl implements DiagramDao {
    private static final String NAMESPACE = "com.example.devnote.diagram.DiagramMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    /**
     * memberId 와 검색 조건을 한 Map 으로 묶는다.
     * Map.of 는 null 값을 허용하지 않는데 diagramType 이 null 일 수 있어 HashMap 을 쓴다.
     */
    private Map<String, Object> searchParameters(Long memberId, DiagramSearchCondition condition) {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("memberId", memberId);
        parameters.put("searchKeyword", condition.resolvedSearchKeyword());
        parameters.put("diagramType", condition.diagramType() == null ? null : condition.diagramType().name());
        parameters.put("offset", condition.offset());
        parameters.put("pageSize", condition.resolvedPageSize());
        return parameters;
    }

    @Override
    public List<DiagramRow> selectDiagrams(Long memberId, DiagramSearchCondition condition) {
        return sqlSessionTemplate.selectList(NAMESPACE + "selectDiagrams", searchParameters(memberId, condition));
    }

    @Override
    public long countDiagrams(Long memberId, DiagramSearchCondition condition) {
        return sqlSessionTemplate.selectOne(NAMESPACE + "countDiagrams", searchParameters(memberId, condition));
    }

    @Override
    public DiagramRow selectDiagram(Long diagramId, Long memberId) {
        return sqlSessionTemplate.selectOne(NAMESPACE + "selectDiagram", Map.of("diagramId", diagramId, "memberId", memberId));
    }

    @Override
    public void insertDiagram(DiagramCreateParameter parameter) {
        sqlSessionTemplate.insert(NAMESPACE + "insertDiagram", parameter);
    }

    @Override
    public int updateDiagram(DiagramUpdateParameter parameter) {
        return sqlSessionTemplate.update(NAMESPACE + "updateDiagram", parameter);
    }

    @Override
    public int softDeleteDiagram(Long diagramId, Long memberId) {
        return sqlSessionTemplate.update(NAMESPACE + "softDeleteDiagram", Map.of("diagramId", diagramId, "memberId", memberId));
    }

    @Override
    public void insertDiagramVersion(DiagramVersionCreateParameter parameter) {
        sqlSessionTemplate.insert(NAMESPACE + "insertDiagramVersion", parameter);
    }

    @Override
    public List<DiagramVersionRow> selectDiagramVersions(Long diagramId) {
        return sqlSessionTemplate.selectList(NAMESPACE + "selectDiagramVersions", diagramId);
    }

    @Override
    public DiagramVersionRow selectDiagramVersion(Long diagramId, Long versionNumber) {
        return sqlSessionTemplate.selectOne(NAMESPACE + "selectDiagramVersion", Map.of("diagramId", diagramId, "versionNumber", versionNumber));
    }

    @Override
    public int deleteOldDiagramVersions(Long diagramId, int keepCount) {
        return sqlSessionTemplate.delete(NAMESPACE + "deleteOldDiagramVersions", Map.of("diagramId", diagramId, "keepCount", keepCount));
    }
}
