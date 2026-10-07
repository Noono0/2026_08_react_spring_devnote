package com.example.devnote.portfolio.dao.parameter;

import lombok.Builder;
import lombok.Getter;

/** portfolio_project_details 저장 값. techStackJson은 ["React","Spring Boot"] 형태의 JSON 문자열이다. */
@Getter
@Builder
public class PortfolioProjectDetailParameter {
    private Long portfolioSectionId;
    private String techStackJson;
    private String roleSummary;
    private String repositoryUrl;
    private String demoUrl;
}
