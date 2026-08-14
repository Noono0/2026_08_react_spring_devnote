package com.example.devnote.snippet.dao;

import com.example.devnote.snippet.dao.parameter.SnippetSaveParameter;
import com.example.devnote.snippet.dao.row.SnippetRow;
import com.example.devnote.snippet.dto.SnippetSearchCondition;

import java.util.List;

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

