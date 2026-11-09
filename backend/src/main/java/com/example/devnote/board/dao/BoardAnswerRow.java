package com.example.devnote.board.dao;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter @Setter
public class BoardAnswerRow {
    private Long answerId;
    private Long postId;
    private Long authorId;
    private String authorName;
    private String contentJson;
    private String contentHtml;
    private String contentText;
    private LocalDateTime createdAt;
}
