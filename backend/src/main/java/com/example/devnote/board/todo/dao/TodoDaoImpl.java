package com.example.devnote.board.todo.dao;

import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Map;
import com.example.devnote.board.todo.domain.TodoOwner;

@Repository @RequiredArgsConstructor
public class TodoDaoImpl implements TodoDao {
    private static final String NAMESPACE = "com.example.devnote.board.TodoMapper.";
    private final SqlSessionTemplate sqlSession;
    @Override public List<TodoRow> list(TodoOwner owner, String status, String keyword, int limit, int offset) {
        return sqlSession.selectList(NAMESPACE + "list", Map.of("owner", owner, "status", status, "keyword", keyword, "limit", limit, "offset", offset));
    }
    @Override public long count(TodoOwner owner, String status, String keyword) {
        Long count = sqlSession.selectOne(NAMESPACE + "count", Map.of("owner", owner, "status", status, "keyword", keyword));
        return count == null ? 0 : count;
    }
    @Override public TodoRow find(long todoId, TodoOwner owner) {
        return sqlSession.selectOne(NAMESPACE + "find", Map.of("todoId", todoId, "owner", owner));
    }
    @Override public void insert(TodoRow row) { sqlSession.insert(NAMESPACE + "insert", row); }
    @Override public int update(TodoRow row, TodoOwner owner) { return sqlSession.update(NAMESPACE + "update", Map.of("row", row, "owner", owner)); }
    @Override public int delete(long todoId, TodoOwner owner, long versionNumber) {
        return sqlSession.delete(NAMESPACE + "delete", Map.of("todoId", todoId, "owner", owner, "versionNumber", versionNumber));
    }
    @Override public long lastGuestTodoId(long guestId) { return sqlSession.selectOne(NAMESPACE + "lastGuestTodoId", guestId); }
    @Override public int mergeGuest(long guestId, long memberId, long throughTodoId) {
        return sqlSession.update(NAMESPACE + "mergeGuest", Map.of("guestId", guestId, "memberId", memberId, "throughTodoId", throughTodoId));
    }
}
