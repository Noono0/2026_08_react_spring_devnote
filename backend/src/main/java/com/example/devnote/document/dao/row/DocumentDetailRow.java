package com.example.devnote.document.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class DocumentDetailRow {
    private Long documentId;
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
