package com.example.devnote.portfolio.dao.parameter;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Builder
public class PortfolioSectionSaveParameter {
    @Setter private Long portfolioSectionId;
    private String sectionType;
    private String contentMode;
    private String sectionTitle;
    private String sectionSubtitle;
    private LocalDate startDate;
    private LocalDate endDate;
    private String currentYn;
    private String externalUrl;
    private Long thumbnailFileId;
    private String contentJson;
    private String contentHtml;
    private String contentText;
    private String layoutType;
    private int sortOrder;
    private String visibility;
    private Long versionNumber;
}
