package com.example.devnote.portfolio.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PortfolioSectionResponse(
    Long portfolioSectionId,
    PortfolioSectionType sectionType,
    PortfolioContentMode contentMode,
    String sectionTitle,
    String sectionSubtitle,
    LocalDate startDate,
    LocalDate endDate,
    boolean current,
    String externalUrl,
    Long thumbnailFileId,
    String thumbnailImageUrl,
    JsonNode contentJson,
    String contentHtml,
    String contentText,
    String layoutType,
    int sortOrder,
    PortfolioVisibility visibility,
    Long versionNumber,
    List<Long> editorImageFileIds,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}

