package com.example.devnote.board.todo.dao;

import java.util.List;
import com.example.devnote.board.todo.domain.TodoOwner;

/** 상세·목록·수정·삭제의 모든 SQL에 작성자 조건을 포함한다. */
public interface TodoDao {
    List<TodoRow> list(TodoOwner owner, String status, String keyword, int limit, int offset);
    long count(TodoOwner owner, String status, String keyword);
    TodoRow find(long todoId, TodoOwner owner);
    void insert(TodoRow row);
    int update(TodoRow row, TodoOwner owner);
    int delete(long todoId, TodoOwner owner, long versionNumber);
    long lastGuestTodoId(long guestId);
    int mergeGuest(long guestId, long memberId, long throughTodoId);
}
