package com.example.devnote.board.todo.dao;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

@Repository @RequiredArgsConstructor
public class TodoReminderDaoImpl implements TodoReminderDao {
    private static final String NAMESPACE = "com.example.devnote.board.TodoReminderMapper.";
    private final SqlSessionTemplate sqlSession;

    @Override public List<TodoReminderRow> list(long todoId) { return sqlSession.selectList(NAMESPACE + "list", todoId); }
    @Override public void insert(long todoId, LocalDateTime scheduledAt, String status) {
        sqlSession.insert(NAMESPACE + "insert", Map.of("todoId", todoId, "scheduledAt", scheduledAt, "status", status));
    }
    @Override public void delete(long reminderId) { sqlSession.delete(NAMESPACE + "delete", reminderId); }
    @Override public void cancel(long todoId) { sqlSession.update(NAMESPACE + "cancel", todoId); }
}
