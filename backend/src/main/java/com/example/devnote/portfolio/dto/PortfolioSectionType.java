package com.example.devnote.portfolio.dto;

/**
 * 섹션 종류. 프론트는 종류마다 다른 카드 모양으로 그린다.
 * 여기 없는 종류가 DB에 남아 있으면 SQL(supportedSectionTypes)에서 걸러 화면 오류를 막는다.
 */
public enum PortfolioSectionType {
    PROFILE,
    RICH_TEXT,
    IMAGE,
    SKILL,
    EXPERIENCE,
    PROJECT,
    EDUCATION,
    CERTIFICATE,
    CONTACT
}
