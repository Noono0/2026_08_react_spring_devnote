package com.example.devnote.snippet.dao;

import com.example.devnote.snippet.dao.parameter.SnippetSaveParameter;
import com.example.devnote.snippet.dao.row.SnippetRow;
import com.example.devnote.snippet.dto.SnippetSearchCondition;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class SnippetDaoImpl implements SnippetDao {
    private static final String NAMESPACE = "com.example.devnote.snippet.SnippetMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    @Override public List<SnippetRow> selectSnippets(SnippetSearchCondition condition) { return sqlSessionTemplate.selectList(NAMESPACE + "selectSnippets", condition); }
    @Override public long countSnippets(SnippetSearchCondition condition) { return sqlSessionTemplate.selectOne(NAMESPACE + "countSnippets", condition); }
    @Override public SnippetRow selectSnippet(Long snippetId, Long memberId) { return sqlSessionTemplate.selectOne(NAMESPACE + "selectSnippet", Map.of("snippetId", snippetId, "memberId", memberId)); }
    @Override public void insertSnippet(SnippetSaveParameter parameter) { sqlSessionTemplate.insert(NAMESPACE + "insertSnippet", parameter); }
    @Override public int updateSnippet(SnippetSaveParameter parameter) { return sqlSessionTemplate.update(NAMESPACE + "updateSnippet", parameter); }
    @Override public int softDeleteSnippet(Long snippetId, Long memberId) { return sqlSessionTemplate.update(NAMESPACE + "softDeleteSnippet", Map.of("snippetId", snippetId, "memberId", memberId)); }
    @Override public int restoreSnippet(Long snippetId, Long memberId) { return sqlSessionTemplate.update(NAMESPACE + "restoreSnippet", Map.of("snippetId", snippetId, "memberId", memberId)); }
    @Override public int softDeleteSnippets(List<Long> snippetIds, Long memberId) { return sqlSessionTemplate.update(NAMESPACE + "softDeleteSnippets", Map.of("snippetIds", snippetIds, "memberId", memberId)); }
    @Override public int restoreSnippets(List<Long> snippetIds, Long memberId) { return sqlSessionTemplate.update(NAMESPACE + "restoreSnippets", Map.of("snippetIds", snippetIds, "memberId", memberId)); }
}

