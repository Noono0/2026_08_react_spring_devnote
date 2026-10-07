package com.example.devnote.portfolio.dao;

import com.example.devnote.portfolio.dao.parameter.PortfolioProjectDetailParameter;
import com.example.devnote.portfolio.dao.parameter.PortfolioSectionSaveParameter;
import com.example.devnote.portfolio.dao.row.PortfolioSectionRow;

import java.util.List;

/**
 * 포트폴리오 테이블 접근 약속.
 *   portfolio_sections        : 섹션 본문(제목·기간·내용·공개 여부·순서)
 *   portfolio_section_files   : 섹션 본문에 들어간 이미지 연결
 *   portfolio_project_details : PROJECT 섹션만 가지는 기술 스택·역할·저장소/데모 링크
 */
public interface PortfolioSectionDao {
    List<PortfolioSectionRow> selectPublicSections();
    List<PortfolioSectionRow> selectAllSections();
    PortfolioSectionRow selectSectionById(Long portfolioSectionId);
    void insertSection(PortfolioSectionSaveParameter parameter);
    int updateSection(PortfolioSectionSaveParameter parameter);
    // 버전이 맞을 때만 지운다(그사이 다른 탭에서 고쳤다면 0건 → 409).
    int softDeleteSection(Long portfolioSectionId, Long versionNumber);
    void deleteEditorImages(Long portfolioSectionId);
    void insertSectionFile(Long portfolioSectionId, Long fileId, String fileRole, int sortOrder);
    List<Long> selectEditorImageFileIds(Long portfolioSectionId);
    void upsertProjectDetail(PortfolioProjectDetailParameter parameter);
    void deleteProjectDetail(Long portfolioSectionId);
}
