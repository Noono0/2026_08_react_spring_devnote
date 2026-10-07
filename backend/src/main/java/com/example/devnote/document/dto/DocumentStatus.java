package com.example.devnote.document.dto;

/**
 * 문서 공개 상태. DRAFT = 작성 중(초안), PUBLISHED = 공개, ARCHIVED = 보관(더 이상 갱신하지 않음).
 * 업무 History에서는 PUBLISHED만 방문자에게 보인다(HistoryController).
 */
public enum DocumentStatus {
    DRAFT,
    PUBLISHED,
    ARCHIVED
}
