package com.example.devnote.snippet.dao;

import com.example.devnote.snippet.dao.parameter.SnippetSaveParameter;
import com.example.devnote.snippet.dao.row.SnippetRow;
import com.example.devnote.snippet.dto.SnippetSearchCondition;

import java.util.List;

/**
 * developer_snippets 테이블 접근 약속.
 * 모든 조회·변경에 memberId가 함께 들어가, SQL 단계에서부터 "내 코드 조각"만 다루게 한다.
 */
public interface SnippetDao {
    List<SnippetRow> selectSnippets(SnippetSearchCondition condition);
    long countSnippets(SnippetSearchCondition condition);
    SnippetRow selectSnippet(Long snippetId, Long memberId);
    void insertSnippet(SnippetSaveParameter parameter);
    int updateSnippet(SnippetSaveParameter parameter);
    int softDeleteSnippet(Long snippetId, Long memberId);
    int restoreSnippet(Long snippetId, Long memberId);
    int softDeleteSnippets(List<Long> snippetIds, Long memberId);
    int restoreSnippets(List<Long> snippetIds, Long memberId);
}

