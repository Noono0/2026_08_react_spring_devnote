package com.example.devnote.portfolio.dao.row;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

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
}

