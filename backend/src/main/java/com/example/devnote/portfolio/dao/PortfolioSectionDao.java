package com.example.devnote.portfolio.dao;

import com.example.devnote.portfolio.dao.parameter.PortfolioSectionSaveParameter;
import com.example.devnote.portfolio.dao.row.PortfolioSectionRow;

import java.util.List;

public interface PortfolioSectionDao {
    List<PortfolioSectionRow> selectPublicSections();
    List<PortfolioSectionRow> selectAllSections();
    PortfolioSectionRow selectSectionById(Long portfolioSectionId);
    void insertSection(PortfolioSectionSaveParameter parameter);
    int updateSection(PortfolioSectionSaveParameter parameter);
    int softDeleteSection(Long portfolioSectionId, Long versionNumber);
    void deleteEditorImages(Long portfolioSectionId);
    void insertSectionFile(Long portfolioSectionId, Long fileId, String fileRole, int sortOrder);
    List<Long> selectEditorImageFileIds(Long portfolioSectionId);
}

