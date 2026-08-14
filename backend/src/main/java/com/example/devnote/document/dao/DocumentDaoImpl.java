package com.example.devnote.document.dao;

import com.example.devnote.document.dao.parameter.DocumentCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentHistoryCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentUpdateParameter;
import com.example.devnote.document.dao.row.DocumentDetailRow;
import com.example.devnote.document.dto.DocumentHistoryResponse;
import com.example.devnote.document.dto.DocumentListItemResponse;
import com.example.devnote.document.dto.DocumentSearchCondition;
import com.example.devnote.file.dto.DocumentAttachmentResponse;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

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

}
