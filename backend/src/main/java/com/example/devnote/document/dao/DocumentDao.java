package com.example.devnote.document.dao;

import com.example.devnote.document.dao.parameter.DocumentCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentHistoryCreateParameter;
import com.example.devnote.document.dao.parameter.DocumentUpdateParameter;
import com.example.devnote.document.dao.row.DocumentDetailRow;
import com.example.devnote.document.dto.DocumentHistoryResponse;
import com.example.devnote.document.dto.DocumentListItemResponse;
import com.example.devnote.document.dto.DocumentSearchCondition;
import com.example.devnote.file.dto.DocumentAttachmentResponse;

import java.util.List;

public interface DocumentDao {
    void insertDocument(DocumentCreateParameter parameter);
    List<DocumentListItemResponse> selectDocumentList(DocumentSearchCondition condition);
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
}
