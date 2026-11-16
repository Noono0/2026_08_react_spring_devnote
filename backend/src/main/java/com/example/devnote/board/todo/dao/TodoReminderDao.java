package com.example.devnote.board.todo.dao;

import java.time.LocalDateTime;
import java.util.List;

public interface TodoReminderDao {
    List<TodoReminderRow> list(long todoId);
    void insert(long todoId, LocalDateTime scheduledAt, String status);
    void delete(long reminderId);
    void cancel(long todoId);
}
