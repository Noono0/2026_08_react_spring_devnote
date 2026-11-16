package com.example.devnote.board.todo.dao;

import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

@Repository @RequiredArgsConstructor
public class TodoGuestDaoImpl implements TodoGuestDao {
    private static final String NAMESPACE = "com.example.devnote.board.TodoGuestMapper.";
    private final SqlSessionTemplate sqlSession;
    @Override public TodoGuestRow findByTokenHash(String tokenHash) { return sqlSession.selectOne(NAMESPACE + "findByTokenHash", tokenHash); }
    @Override public void insert(TodoGuestRow row) { sqlSession.insert(NAMESPACE + "insert", row); }
}
