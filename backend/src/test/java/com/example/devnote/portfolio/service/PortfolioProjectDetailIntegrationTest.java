package com.example.devnote.portfolio.service;

import com.example.devnote.DevNoteApplication;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.portfolio.dto.PortfolioContentMode;
import com.example.devnote.portfolio.dto.PortfolioSectionResponse;
import com.example.devnote.portfolio.dto.PortfolioSectionSaveRequest;
import com.example.devnote.portfolio.dto.PortfolioSectionType;
import com.example.devnote.portfolio.dto.PortfolioVisibility;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** PROJECT 섹션의 기술 스택·링크가 실제 MySQL에 저장·조회·정리되는지 확인합니다. */
@SpringBootTest(classes = DevNoteApplication.class)
@ActiveProfiles("test")
@Testcontainers
class PortfolioProjectDetailIntegrationTest {
    @Container
    static final MySQLContainer<?> MYSQL_CONTAINER = new MySQLContainer<>("mysql:8.4")
        .withDatabaseName("devnote_test")
        .withUsername("devnote")
        .withPassword("devnote");

    @DynamicPropertySource
    static void registerDatabaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL_CONTAINER::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL_CONTAINER::getUsername);
        registry.add("spring.datasource.password", MYSQL_CONTAINER::getPassword);
    }

    @Autowired private PortfolioSectionService portfolioSectionService;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void savesProjectDetailWithNormalizedTechStackAndRemovesItWhenTypeChanges() {
        PortfolioSectionResponse created = portfolioSectionService.createSection(request(
            PortfolioSectionType.PROJECT, List.of(" React ", "Spring Boot", "react", ""), "https://github.com/example/devnote", null));

        assertThat(created.techStack()).containsExactly("React", "Spring Boot");
        assertThat(created.repositoryUrl()).isEqualTo("https://github.com/example/devnote");
        assertThat(created.roleSummary()).isEqualTo("프론트엔드·백엔드 전체");
        assertThat(portfolioSectionService.getPublicSections())
            .filteredOn(section -> section.portfolioSectionId().equals(created.portfolioSectionId()))
            .singleElement()
            .satisfies(section -> assertThat(section.techStack()).containsExactly("React", "Spring Boot"));

        PortfolioSectionResponse changed = portfolioSectionService.updateSection(created.portfolioSectionId(), request(
            PortfolioSectionType.RICH_TEXT, List.of("React"), null, created.versionNumber()));

        assertThat(changed.techStack()).isEmpty();
        assertThat(changed.repositoryUrl()).isNull();
        assertThat(jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM portfolio_project_details WHERE portfolio_section_id = ?", Integer.class, created.portfolioSectionId()))
            .isZero();
    }

    @Test
    void rejectsNonHttpRepositoryUrl() {
        assertThatThrownBy(() -> portfolioSectionService.createSection(request(
            PortfolioSectionType.PROJECT, List.of("React"), "javascript:alert(1)", null)))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("저장소 주소");
    }

    private PortfolioSectionSaveRequest request(
        PortfolioSectionType sectionType, List<String> techStack, String repositoryUrl, Long versionNumber
    ) {
        return new PortfolioSectionSaveRequest(
            sectionType, PortfolioContentMode.RICH_TEXT, "DevNote", "개인 프로젝트", null, null, false, null, null,
            objectMapper.createObjectNode().put("type", "doc"), "<p>본문</p>", "본문", "DEFAULT", 10,
            PortfolioVisibility.PUBLIC, List.of(), versionNumber,
            techStack, "프론트엔드·백엔드 전체", repositoryUrl, null);
    }
}
