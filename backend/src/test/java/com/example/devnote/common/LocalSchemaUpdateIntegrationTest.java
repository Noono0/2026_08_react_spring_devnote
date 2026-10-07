package com.example.devnote.common;

import com.example.devnote.DevNoteApplication;
import com.example.devnote.document.dto.DocumentCreateRequest;
import com.example.devnote.document.dto.DocumentScope;
import com.example.devnote.document.dto.DocumentStatus;
import com.example.devnote.document.service.DocumentService;
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

/**
 * 로컬 Docker·bootRun의 기본값(JPA_DDL_AUTO=update)으로 기동해도 schema.sql의 컬럼 기본값이 남는지 확인합니다.
 *
 * Hibernate update는 기동할 때마다 char 컬럼을 Entity의 columnDefinition대로 다시 정의합니다.
 * columnDefinition에 default가 빠져 있으면 DEFAULT 'Y'가 지워져, use_yn을 넣지 않는 문서 INSERT가 실패했습니다.
 */
@SpringBootTest(classes = DevNoteApplication.class, properties = "spring.jpa.hibernate.ddl-auto=update")
@ActiveProfiles("test")
@Testcontainers
class LocalSchemaUpdateIntegrationTest {
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

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private DocumentService documentService;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void keepsColumnDefaultsAfterHibernateUpdate() {
        assertThat(columnDefault("documents", "use_yn")).isEqualTo("Y");
        assertThat(columnDefault("members", "use_yn")).isEqualTo("Y");
        assertThat(columnDefault("portfolio_sections", "use_yn")).isEqualTo("Y");
        assertThat(columnDefault("portfolio_sections", "current_yn")).isEqualTo("N");
    }

    @Test
    void createsDocumentWithoutExplicitUseYn() {
        var created = documentService.createDocument(new DocumentCreateRequest(
            "로컬 기동 확인", null, List.of(), List.of(), objectMapper.createObjectNode().put("type", "doc"),
            "<p>내용</p>", "내용", DocumentStatus.PUBLISHED), 1L, DocumentScope.HISTORY);

        assertThat(created.documentId()).isPositive();
    }

    private String columnDefault(String tableName, String columnName) {
        return jdbcTemplate.queryForObject("""
            SELECT COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
            """, String.class, tableName, columnName);
    }
}
