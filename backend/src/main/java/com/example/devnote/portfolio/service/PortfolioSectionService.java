package com.example.devnote.portfolio.service;

import com.example.devnote.portfolio.dto.PortfolioSectionResponse;
import com.example.devnote.portfolio.dto.PortfolioSectionSaveRequest;

import java.util.List;

public interface PortfolioSectionService {
    List<PortfolioSectionResponse> getPublicSections();
    List<PortfolioSectionResponse> getAllSections();
    PortfolioSectionResponse createSection(PortfolioSectionSaveRequest request);
    PortfolioSectionResponse updateSection(Long portfolioSectionId, PortfolioSectionSaveRequest request);
    void deleteSection(Long portfolioSectionId, Long versionNumber);
}

