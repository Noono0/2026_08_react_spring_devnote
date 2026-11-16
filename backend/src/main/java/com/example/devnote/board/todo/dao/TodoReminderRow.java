package com.example.devnote.board.todo.dao;

import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class TodoReminderRow {
    private Long reminderId;
    private Long todoId;
    private LocalDateTime scheduledAt;
    private String status;
}
