package com.example.devnote.document.dto;

import java.time.LocalDateTime;

/**
 * 변경 이력 목록의 한 줄. 본문 전체는 크기 때문에 목록에는 넣지 않고 제목·요약·수정자·시각만 보낸다.
 * versionNumber는 "이 내용이 몇 번째 버전이었는지"(수정 전 버전 번호)다.
 */
public record DocumentHistoryResponse(
    Long documentHistoryId,
    Long documentId,
    Long versionNumber,
    String documentTitle,
    String changeSummary,
    Long changedBy,
    String changedByName,
    LocalDateTime createdAt
) {
}
