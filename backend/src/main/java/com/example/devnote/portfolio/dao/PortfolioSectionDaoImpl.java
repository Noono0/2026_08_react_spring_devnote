package com.example.devnote.portfolio.dao;

import com.example.devnote.portfolio.dao.parameter.PortfolioSectionSaveParameter;
import com.example.devnote.portfolio.dao.row.PortfolioSectionRow;
import lombok.RequiredArgsConstructor;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class PortfolioSectionDaoImpl implements PortfolioSectionDao {
    private static final String NAMESPACE = "com.example.devnote.portfolio.PortfolioSectionMapper.";
    private final SqlSessionTemplate sqlSessionTemplate;

    @Override public List<PortfolioSectionRow> selectPublicSections() { return sqlSessionTemplate.selectList(NAMESPACE + "selectPublicSections"); }
    @Override public List<PortfolioSectionRow> selectAllSections() { return sqlSessionTemplate.selectList(NAMESPACE + "selectAllSections"); }
    @Override public PortfolioSectionRow selectSectionById(Long id) { return sqlSessionTemplate.selectOne(NAMESPACE + "selectSectionById", id); }
    @Override public void insertSection(PortfolioSectionSaveParameter parameter) { sqlSessionTemplate.insert(NAMESPACE + "insertSection", parameter); }
    @Override public int updateSection(PortfolioSectionSaveParameter parameter) { return sqlSessionTemplate.update(NAMESPACE + "updateSection", parameter); }
    @Override public int softDeleteSection(Long id, Long version) { return sqlSessionTemplate.update(NAMESPACE + "softDeleteSection", Map.of("portfolioSectionId", id, "versionNumber", version)); }
    @Override public void deleteEditorImages(Long id) { sqlSessionTemplate.delete(NAMESPACE + "deleteEditorImages", id); }
    @Override public void insertSectionFile(Long id, Long fileId, String role, int order) { sqlSessionTemplate.insert(NAMESPACE + "insertSectionFile", Map.of("portfolioSectionId", id, "fileId", fileId, "fileRole", role, "sortOrder", order)); }
    @Override public List<Long> selectEditorImageFileIds(Long id) { return sqlSessionTemplate.selectList(NAMESPACE + "selectEditorImageFileIds", id); }
}
