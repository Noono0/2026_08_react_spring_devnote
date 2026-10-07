package com.example.devnote.document.dao;

import com.example.devnote.document.dao.parameter.DocumentCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentHistoryCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentUpdateParameter;
import com.example.devnote.document.dao.row.DocumentDetailRow;
import com.example.devnote.document.dao.row.DocumentTagRow;
import com.example.devnote.document.dto.DocumentTagCountResponse;
import com.example.devnote.document.dto.DocumentHistoryResponse;
import com.example.devnote.document.dto.DocumentListItemResponse;
import com.example.devnote.document.dto.DocumentSearchCondition;
import com.example.devnote.file.dto.DocumentAttachmentResponse;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * DocumentDao의 MyBatis 구현. 각 메서드는 DocumentMapper.xml의 같은 id SQL을 실행하는 한 줄짜리 연결이다.
 * SqlSessionTemplate: Spring 트랜잭션에 참여하는 MyBatis 실행기. Service의 @Transactional 안에서 같은 DB 연결을 쓴다.
 */
@Repository
@RequiredArgsConstructor
public class DocumentDaoImpl implements DocumentDao {
    private static final String NAMESPACE = "com.example.devnote.document.DocumentMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    @Override
    public void insertDocument(DocumentCreateParameter parameter) {
        sqlSessionTemplate.insert(NAMESPACE + "insertDocument", parameter);
    }

    @Override
    public List<DocumentListItemResponse> selectDocumentList(DocumentSearchCondition condition) {
        return sqlSessionTemplate.selectList(NAMESPACE + "selectDocumentList", condition);
    }

    @Override
    public long countDocumentList(DocumentSearchCondition condition) {
        Long count = sqlSessionTemplate.selectOne(NAMESPACE + "countDocumentList", condition);
        // 결과가 없을 때 null을 long으로 바꾸다 NullPointerException이 나지 않게 0으로 바꾼다.
        return count == null ? 0 : count;
    }

    @Override
    public DocumentDetailRow selectDocumentById(Long documentId) {
        return sqlSessionTemplate.selectOne(NAMESPACE + "selectDocumentById", documentId);
    }

    @Override
    public int updateDocument(DocumentUpdateParameter parameter) {
        return sqlSessionTemplate.update(NAMESPACE + "updateDocument", parameter);
    }

    @Override
    public int softDeleteDocument(Long documentId, Long memberId, String documentScope) {
        // 값이 여러 개면 Map으로 이름을 붙여 넘긴다. XML의 #{documentId} 등이 이 이름을 찾는다.
        return sqlSessionTemplate.update(NAMESPACE + "softDeleteDocument", Map.of("documentId", documentId, "memberId", memberId, "documentScope", documentScope));
    }

    @Override
    public int restoreDocument(Long documentId, Long memberId, String documentScope) {
        return sqlSessionTemplate.update(NAMESPACE + "restoreDocument", Map.of("documentId", documentId, "memberId", memberId, "documentScope", documentScope));
    }

    @Override
    public void updateDocumentScope(Long documentId, String documentScope) {
        sqlSessionTemplate.update(NAMESPACE + "updateDocumentScope", Map.of("documentId", documentId, "documentScope", documentScope));
    }

    @Override
    public void insertDocumentHistory(DocumentHistoryCreateParameter parameter) {
        sqlSessionTemplate.insert(NAMESPACE + "insertDocumentHistory", parameter);
    }

    @Override
    public List<DocumentHistoryResponse> selectDocumentHistories(Long documentId) {
        return sqlSessionTemplate.selectList(NAMESPACE + "selectDocumentHistories", documentId);
    }
    @Override
    public void deleteDocumentAttachments(Long documentId) {
        sqlSessionTemplate.delete(NAMESPACE + "deleteDocumentAttachments", documentId);
    }

    @Override
    public void insertDocumentAttachment(Long documentId, Long fileId, int sortOrder) {
        sqlSessionTemplate.insert(
            NAMESPACE + "insertDocumentAttachment",
            Map.of("documentId", documentId, "fileId", fileId, "sortOrder", sortOrder)
        );
    }

    @Override
    public List<DocumentAttachmentResponse> selectDocumentAttachments(Long documentId) {
        return sqlSessionTemplate.selectList(NAMESPACE + "selectDocumentAttachments", documentId);
    }

    @Override
    public List<DocumentTagRow> selectTagsByDocumentIds(List<Long> documentIds) {
        // IN ()은 SQL 문법 오류이므로 빈 목록이면 조회하지 않는다.
        if (documentIds.isEmpty()) return List.of();
        return sqlSessionTemplate.selectList(NAMESPACE + "selectTagsByDocumentIds", documentIds);
    }

    @Override
    public void deleteDocumentTags(Long documentId) {
        sqlSessionTemplate.delete(NAMESPACE + "deleteDocumentTags", documentId);
    }

    @Override
    public void insertDocumentTags(Long documentId, List<String> tags) {
        if (tags.isEmpty()) return;
        sqlSessionTemplate.insert(NAMESPACE + "insertDocumentTags", Map.of("documentId", documentId, "tags", tags));
    }

    @Override
    public List<DocumentTagCountResponse> selectPopularTags(String documentScope, Long authorId, String documentStatus) {
        // authorId·documentStatus는 null일 수 있어 Map.of 대신 HashMap을 쓴다(Map.of는 null 값을 허용하지 않는다).
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("documentScope", documentScope);
        parameters.put("authorId", authorId);
        parameters.put("documentStatus", documentStatus);
        return sqlSessionTemplate.selectList(NAMESPACE + "selectPopularTags", parameters);
    }
}
