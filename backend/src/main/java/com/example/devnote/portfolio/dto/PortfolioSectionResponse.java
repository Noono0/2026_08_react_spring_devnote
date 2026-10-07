package com.example.devnote.portfolio.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 섹션 응답. 프론트 portfolioTypes.ts(Zod 스키마)와 필드 이름이 같아야 한다.
 * enum 필드(sectionType 등)는 JSON에서 "PROJECT" 같은 문자열로 나간다.
 * techStack·roleSummary·repositoryUrl·demoUrl은 PROJECT 섹션에서만 값이 있다(그 외에는 빈 목록·null).
 */
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
    LocalDateTime updatedAt,
    List<String> techStack,
    String roleSummary,
    String repositoryUrl,
    String demoUrl
) {
}

