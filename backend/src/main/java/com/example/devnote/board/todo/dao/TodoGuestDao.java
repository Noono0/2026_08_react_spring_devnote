package com.example.devnote.board.todo.dao;

public interface TodoGuestDao {
    TodoGuestRow findByTokenHash(String tokenHash);
    void insert(TodoGuestRow row);
}
