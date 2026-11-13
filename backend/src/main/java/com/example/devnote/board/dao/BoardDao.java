package com.example.devnote.board.dao;

import java.util.List;
import java.time.LocalDate;

/** SQL만 수행한다. 게시판 종류별 권한과 본문 검증은 Service가 맡는다. */
public interface BoardDao {
    List<BoardPostRow> list(String boardType, String keyword, int limit, int offset);
    long count(String boardType, String keyword);
    List<BoardPostRow> calendar(LocalDate startDate, LocalDate endDate, String keyword, int limit);
    BoardPostRow find(long postId);
    void insert(BoardPostRow post);
    int update(BoardPostRow post);
    void upsertCalendarDate(long postId, LocalDate eventDate, LocalDate eventEndDate);
    void upsertPopup(long postId, String targetPath, boolean includeChildren, boolean enabled, LocalDate startDate, LocalDate endDate);
    List<BoardPostRow> activePopups(String path, LocalDate today);
    int delete(long postId, long versionNumber);
    void incrementViews(long postId);
    BoardAnswerRow findAnswer(long postId);
    void insertAnswer(BoardAnswerRow answer);
    int deleteAnswer(long postId);
    void setAnswered(long postId, boolean answered);
}
