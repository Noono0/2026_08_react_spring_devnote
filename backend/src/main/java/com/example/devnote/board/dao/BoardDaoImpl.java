package com.example.devnote.board.dao;

import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;

@Repository
@RequiredArgsConstructor
public class BoardDaoImpl implements BoardDao {
    private static final String NAMESPACE = "com.example.devnote.board.BoardMapper.";
    private final SqlSessionTemplate sqlSession;

    @Override public List<BoardPostRow> list(String boardType, String keyword, int limit, int offset) {
        return sqlSession.selectList(NAMESPACE + "list", Map.of("boardType", boardType, "keyword", keyword, "limit", limit, "offset", offset));
    }
    @Override public long count(String boardType, String keyword) {
        Long count = sqlSession.selectOne(NAMESPACE + "count", Map.of("boardType", boardType, "keyword", keyword));
        return count == null ? 0 : count;
    }
    @Override public List<BoardPostRow> calendar(LocalDate startDate, LocalDate endDate, String keyword, int limit) {
        return sqlSession.selectList(NAMESPACE + "calendar", Map.of("startDate", startDate, "endDate", endDate, "keyword", keyword, "limit", limit));
    }
    @Override public BoardPostRow find(long postId) { return sqlSession.selectOne(NAMESPACE + "find", postId); }
    @Override public void insert(BoardPostRow post) { sqlSession.insert(NAMESPACE + "insert", post); }
    @Override public int update(BoardPostRow post) { return sqlSession.update(NAMESPACE + "update", post); }
    @Override public void upsertCalendarDate(long postId, LocalDate eventDate) {
        sqlSession.insert(NAMESPACE + "upsertCalendarDate", Map.of("postId", postId, "eventDate", eventDate));
    }
    @Override public int delete(long postId, long versionNumber) {
        return sqlSession.update(NAMESPACE + "delete", Map.of("postId", postId, "versionNumber", versionNumber));
    }
    @Override public void incrementViews(long postId) { sqlSession.update(NAMESPACE + "incrementViews", postId); }
    @Override public BoardAnswerRow findAnswer(long postId) { return sqlSession.selectOne(NAMESPACE + "findAnswer", postId); }
    @Override public void insertAnswer(BoardAnswerRow answer) { sqlSession.insert(NAMESPACE + "insertAnswer", answer); }
    @Override public int deleteAnswer(long postId) { return sqlSession.delete(NAMESPACE + "deleteAnswer", postId); }
    @Override public void setAnswered(long postId, boolean answered) {
        sqlSession.update(NAMESPACE + "setAnswered", Map.of("postId", postId, "answered", answered));
    }
}
