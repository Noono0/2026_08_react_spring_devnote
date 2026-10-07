package com.example.devnote.file.dao;

import com.example.devnote.DevNoteApplication;
import com.example.devnote.file.service.TemporaryFileCleanupService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 미사용 임시 파일 정리 SQL이 실제 MySQL에서 "쓰는 파일은 남기고 안 쓰는 파일만" 지우는지 확인합니다.
 */
@SpringBootTest(classes = DevNoteApplication.class)
@ActiveProfiles("test")
@Testcontainers
class TemporaryFileCleanupMapperTest {
    private static final Path STORAGE_DIRECTORY = createStorageDirectory();

    @Container
    static final MySQLContainer<?> MYSQL_CONTAINER = new MySQLContainer<>("mysql:8.4")
        .withDatabaseName("devnote_test")
        .withUsername("devnote")
        .withPassword("devnote");

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL_CONTAINER::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL_CONTAINER::getUsername);
        registry.add("spring.datasource.password", MYSQL_CONTAINER::getPassword);
        registry.add("application.file-storage.root-directory", STORAGE_DIRECTORY::toString);
    }

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private TemporaryFileCleanupService cleanupService;

    @Test
    void deletesOnlyOldTemporaryFilesThatNothingReferences() throws IOException {
        long unusedOld = insertFile("unused-old.png", "TEMP", true);
        long usedInDocumentBody = insertFile("body-image.png", "TEMP", true);
        long usedInHistoryBody = insertFile("history-image.png", "TEMP", true);
        long attached = insertFile("attachment.pdf", "TEMP", true);
        long portfolioImage = insertFile("portfolio.png", "TEMP", true);
        long recentUpload = insertFile("recent.png", "TEMP", false);
        long activeFile = insertFile("active.png", "ACTIVE", true);

        long documentId = insertDocument(
            "<p><img src=\"/api/v1/files/" + usedInDocumentBody + "/content\"></p>"
                // 파일 번호 뒤에 숫자가 더 붙은 다른 파일 주소는 unusedOld의 사용으로 보지 않아야 합니다.
                + "<p><img src=\"/api/v1/files/" + unusedOld + "0/content\"></p>");
        jdbcTemplate.update("""
            INSERT INTO document_histories (document_id, version_number, document_title, document_status,
                content_json, content_html, content_text, changed_by)
            VALUES (?, 1, '이전 버전', 'DRAFT', '{}', ?, '', 1)
            """, documentId, "<img src=\"/api/v1/files/" + usedInHistoryBody + "/content\">");
        jdbcTemplate.update("INSERT INTO document_files (document_id, file_id, file_role) VALUES (?, ?, 'ATTACHMENT')",
            documentId, attached);
        jdbcTemplate.update("""
            INSERT INTO portfolio_sections (section_type, content_mode, section_title, content_json, content_html, content_text)
            VALUES ('IMAGE', 'RICH_TEXT', '이미지', '{}', '', '')
            """);
        Long sectionId = jdbcTemplate.queryForObject("SELECT MAX(portfolio_section_id) FROM portfolio_sections", Long.class);
        jdbcTemplate.update("INSERT INTO portfolio_section_files (portfolio_section_id, file_id, file_role) VALUES (?, ?, 'EDITOR_IMAGE')",
            sectionId, portfolioImage);

        TemporaryFileCleanupService.CleanupResult result = cleanupService.cleanUpUnusedTemporaryFiles();

        assertThat(result.markedDeletedCount()).isEqualTo(1);
        assertThat(status(unusedOld)).isEqualTo("DELETED");
        assertThat(STORAGE_DIRECTORY.resolve("unused-old.png")).doesNotExist();
        for (long keptFileId : new long[] {usedInDocumentBody, usedInHistoryBody, attached, portfolioImage, recentUpload}) {
            assertThat(status(keptFileId)).as("fileId=%d", keptFileId).isEqualTo("TEMP");
        }
        assertThat(status(activeFile)).isEqualTo("ACTIVE");
        assertThat(STORAGE_DIRECTORY.resolve("body-image.png")).exists();
    }

    private long insertFile(String storedFileName, String status, boolean uploadedTwoDaysAgo) throws IOException {
        Path storedFile = Files.writeString(STORAGE_DIRECTORY.resolve(storedFileName), "content");
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO file_resources (uploader_id, original_file_name, stored_file_name, file_extension,
                    mime_type, file_size, storage_path, file_status, created_at)
                VALUES (1, ?, ?, 'png', 'image/png', 7, ?, ?,
                    IF(?, CURRENT_TIMESTAMP(6) - INTERVAL 2 DAY, CURRENT_TIMESTAMP(6)))
                """, Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, storedFileName);
            statement.setString(2, storedFileName);
            statement.setString(3, storedFile.toAbsolutePath().toString());
            statement.setString(4, status);
            statement.setBoolean(5, uploadedTwoDaysAgo);
            return statement;
        }, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey()).longValue();
    }

    private long insertDocument(String contentHtml) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO documents (member_id, document_title, document_status, content_json, content_html, content_text)
                VALUES (1, '본문 이미지 문서', 'DRAFT', '{}', ?, '')
                """, Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, contentHtml);
            return statement;
        }, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey()).longValue();
    }

    private String status(long fileId) {
        return jdbcTemplate.queryForObject("SELECT file_status FROM file_resources WHERE file_id = ?", String.class, fileId);
    }

    private static Path createStorageDirectory() {
        try {
            return Files.createTempDirectory("devnote-cleanup-test");
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
