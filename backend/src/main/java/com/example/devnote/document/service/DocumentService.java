package com.example.devnote.document.service;

import com.example.devnote.document.dto.*;

import java.util.List;

public interface DocumentService {
    DocumentDetailResponse createDocument(DocumentCreateRequest request, Long memberId);
    DocumentDetailResponse createDocument(DocumentCreateRequest request, Long memberId, DocumentScope documentScope);
    PageResponse<DocumentListItemResponse> getDocumentList(DocumentSearchCondition condition);
    DocumentDetailResponse getDocumentDetail(Long documentId);
    DocumentDetailResponse getDocumentDetail(Long documentId, DocumentScope documentScope);
    DocumentDetailResponse updateDocument(Long documentId, DocumentUpdateRequest request, Long memberId);
    DocumentDetailResponse updateDocument(Long documentId, DocumentUpdateRequest request, Long memberId, DocumentScope documentScope);
    void deleteDocument(Long documentId, Long memberId);
    void deleteDocument(Long documentId, Long memberId, DocumentScope documentScope);
    void restoreDocument(Long documentId, Long memberId);
    List<DocumentHistoryResponse> getDocumentHistories(Long documentId);
}
