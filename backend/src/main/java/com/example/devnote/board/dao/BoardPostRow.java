package com.example.devnote.board.dao;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.time.LocalDate;

/** MyBatis가 읽은 게시글. API에 그대로 반환하지 않는다. */
@Getter @Setter
public class BoardPostRow {
    private Long postId;
    private String boardType;
    private Long authorId;
    private String authorName;
    private String title;
    private String contentJson;
    private String contentHtml;
    private String contentText;
    private Long imageFileId;
    private Boolean pinned;
    private Boolean answered;
    private Long viewCount;
    private Long versionNumber;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDate eventDate;
    private LocalDate eventEndDate;
    private String popupTargetPath;
    private Boolean popupIncludeChildren;
    private Boolean popupEnabled;
}
