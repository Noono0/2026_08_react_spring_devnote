package com.example.devnote.portfolio.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 섹션 SELECT 결과 한 행 + PROJECT 상세(LEFT JOIN). Service가 이것을 PortfolioSectionResponse로 바꾼다. */
@Getter
@Setter
public class PortfolioSectionRow {
    private Long portfolioSectionId;
    private String sectionType;
    private String contentMode;
    private String sectionTitle;
    private String sectionSubtitle;
    private LocalDate startDate;
    private LocalDate endDate;
    private String currentYn;
    private String externalUrl;
    private Long thumbnailFileId;
    private String thumbnailImageUrl;
    private String contentJson;
    private String contentHtml;
    private String contentText;
    private String layoutType;
    private int sortOrder;
    private String visibility;
    private Long versionNumber;
    private String useYn;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // portfolio_project_details LEFT JOIN 결과. PROJECT가 아니거나 상세 정보가 없으면 null이다.
    private String techStackJson;
    private String roleSummary;
    private String repositoryUrl;
    private String demoUrl;
}

