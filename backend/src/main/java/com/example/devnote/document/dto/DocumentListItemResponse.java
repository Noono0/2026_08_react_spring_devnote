package com.example.devnote.document.dto;

import org.apache.ibatis.annotations.AutomapConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 문서 목록의 한 줄. 목록에는 본문(contentJson·contentHtml)을 넣지 않아 응답을 가볍게 유지한다.
 * record는 값을 바꿀 수 없으므로, 태그를 채울 때는 withTags로 "태그만 다른 새 객체"를 만든다(불변 객체 패턴).
 */
public record DocumentListItemResponse(
    Long documentId,
    String documentTitle,
    String documentStatus,
    Long thumbnailFileId,
    String thumbnailImageUrl,
    Long versionNumber,
    Long viewCount,
    Long authorId,
    String authorName,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<String> tags
) {
    /**
     * MyBatis가 목록 SQL 결과(11개 컬럼)로 객체를 만들 때 쓰는 생성자입니다.
     * 태그는 문서마다 여러 개라 같은 SQL에서 한 줄로 받지 않고, Service가 따로 조회해 withTags로 채웁니다.
     */
    @AutomapConstructor
    public DocumentListItemResponse(
        Long documentId, String documentTitle, String documentStatus, Long thumbnailFileId, String thumbnailImageUrl,
        Long versionNumber, Long viewCount, Long authorId, String authorName, LocalDateTime createdAt, LocalDateTime updatedAt
    ) {
        this(documentId, documentTitle, documentStatus, thumbnailFileId, thumbnailImageUrl,
            versionNumber, viewCount, authorId, authorName, createdAt, updatedAt, List.of());
    }

    /** List.copyOf: 넘겨받은 목록을 복사해, 원본이 나중에 바뀌어도 이 객체의 태그는 변하지 않게 한다. */
    public DocumentListItemResponse withTags(List<String> documentTags) {
        return new DocumentListItemResponse(documentId, documentTitle, documentStatus, thumbnailFileId, thumbnailImageUrl,
            versionNumber, viewCount, authorId, authorName, createdAt, updatedAt, List.copyOf(documentTags));
    }
}
