package com.example.devnote.document.service;

import com.example.devnote.document.dto.*;

import java.util.List;

/**
 * 문서 업무 규칙의 약속(인터페이스). 구현은 DocumentServiceImpl에 있다.
 *
 * 같은 이름의 메서드가 두 개씩 있는 이유(오버로딩):
 *   documentScope가 없는 쪽 = 예전 코드·테스트용 짧은 버전(PRACTICE로 처리).
 *   documentScope가 있는 쪽 = 연습장(PRACTICE)과 업무 History(HISTORY)를 구분하는 실제 버전.
 */
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
    /** 태그 필터 버튼용. authorId·documentStatus가 null이면 그 조건으로 거르지 않는다. */
    List<DocumentTagCountResponse> getPopularTags(DocumentScope documentScope, Long authorId, DocumentStatus documentStatus);
}
