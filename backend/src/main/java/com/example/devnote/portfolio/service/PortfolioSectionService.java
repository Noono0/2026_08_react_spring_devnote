package com.example.devnote.portfolio.service;

import com.example.devnote.portfolio.dto.PortfolioSectionResponse;
import com.example.devnote.portfolio.dto.PortfolioSectionSaveRequest;

import java.util.List;

/** 포트폴리오 섹션 업무 규칙의 약속. 권한 확인은 Controller가 PortfolioEditSessionService로 먼저 끝낸 뒤 호출한다. */
public interface PortfolioSectionService {
    List<PortfolioSectionResponse> getPublicSections();
    List<PortfolioSectionResponse> getAllSections();
    PortfolioSectionResponse createSection(PortfolioSectionSaveRequest request);
    PortfolioSectionResponse updateSection(Long portfolioSectionId, PortfolioSectionSaveRequest request);
    void deleteSection(Long portfolioSectionId, Long versionNumber);
}
