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

import java.util.List;

/**
 * 문서 관련 테이블(documents, document_histories, document_files, document_tags)에 접근하는 약속입니다.
 * 업무 판단은 하지 않고 "SQL 실행 결과"만 돌려준다. 판단은 Service의 몫이다.
 *
 * int를 돌려주는 update/delete 메서드: 실제로 바뀐 행 수. Service가 0인지 보고 404·409를 결정한다.
 */
public interface DocumentDao {
    void insertDocument(DocumentCreateParameter parameter);
    List<DocumentListItemResponse> selectDocumentList(DocumentSearchCondition condition);
    // 목록과 같은 WHERE 조건으로 전체 건수만 센다(페이지 계산용).
    long countDocumentList(DocumentSearchCondition condition);
    DocumentDetailRow selectDocumentById(Long documentId);
    int updateDocument(DocumentUpdateParameter parameter);
    int softDeleteDocument(Long documentId, Long memberId, String documentScope);
    int restoreDocument(Long documentId, Long memberId, String documentScope);
    void updateDocumentScope(Long documentId, String documentScope);
    void insertDocumentHistory(DocumentHistoryCreateParameter parameter);
    List<DocumentHistoryResponse> selectDocumentHistories(Long documentId);
    void deleteDocumentAttachments(Long documentId);
    void insertDocumentAttachment(Long documentId, Long fileId, int sortOrder);
    List<DocumentAttachmentResponse> selectDocumentAttachments(Long documentId);
    // 여러 문서의 태그를 IN (...)으로 한 번에 조회한다(N+1 쿼리 방지).
    List<DocumentTagRow> selectTagsByDocumentIds(List<Long> documentIds);
    void deleteDocumentTags(Long documentId);
    void insertDocumentTags(Long documentId, List<String> tags);
    List<DocumentTagCountResponse> selectPopularTags(String documentScope, Long authorId, String documentStatus);
}
