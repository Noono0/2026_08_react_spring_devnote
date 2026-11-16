package com.example.devnote.board.todo.dao;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter @Setter
public class TodoRow {
    private Long todoId;
    private Long authorId;
    private Long guestId;
    private String title;
    private String content;
    private Boolean completed;
    private Long versionNumber;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
