package com.example.devnote.document.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 문서 상세 SELECT 결과 한 행(DAO → Service 전달용).
 * 응답 DTO와 따로 둔 이유: 응답에 내보내지 않는 값(documentScope, useYn, deletedAt)으로 Service가 판단해야 하고,
 * contentJson은 DB에서 문자열로 읽은 뒤 Service가 JSON 객체로 바꾸기 때문이다.
 */
@Getter
@Setter
public class DocumentDetailRow {
    private Long documentId;
    // SQL에서 member_id AS author_id, member_name AS author_name 으로 이름을 바꿔 읽는다(members 테이블 JOIN).
    private Long authorId;
    private String authorName;
    private String documentTitle;
    private String documentScope;
    private Long thumbnailFileId;
    private String thumbnailImageUrl;
    private String contentJson;
    private String contentHtml;
    private String contentText;
    private String documentStatus;
    private Long versionNumber;
    private Long viewCount;
    private String useYn;
    private LocalDateTime deletedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
