package com.example.devnote.document.service;

import com.example.devnote.DevNoteApplication;
import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.document.dto.DocumentCreateRequest;
import com.example.devnote.document.dto.DocumentDetailResponse;
import com.example.devnote.document.dto.DocumentScope;
import com.example.devnote.document.dto.DocumentSearchCondition;
import com.example.devnote.document.dto.DocumentStatus;
import com.example.devnote.document.dto.DocumentTagCountResponse;
import com.example.devnote.document.dto.DocumentUpdateRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 업무 History 태그 저장·정리·목록 필터·인기 태그 집계를 실제 MySQL로 확인합니다. */
@SpringBootTest(classes = DevNoteApplication.class)
@ActiveProfiles("test")
@Testcontainers
class DocumentTagIntegrationTest {
    private static final long OWNER_MEMBER_ID = 1L;

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

    @Autowired private DocumentService documentService;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void savesNormalizedTagsAndFiltersListByTag() {
        DocumentDetailResponse deployment = create("배포 정리", List.of("#배포", " Nginx ", "nginx", "#"), DocumentStatus.PUBLISHED);
        create("성능 개선", List.of("성능", "Nginx"), DocumentStatus.PUBLISHED);
        create("작성 중", List.of("배포"), DocumentStatus.DRAFT);

        assertThat(deployment.tags()).containsExactly("배포", "Nginx");

        DocumentSearchCondition condition = historyCondition();
        condition.setTag("Nginx");
        assertThat(documentService.getDocumentList(condition).content())
            .extracting(item -> item.documentTitle())
            .containsExactlyInAnyOrder("배포 정리", "성능 개선");
        assertThat(documentService.getDocumentList(condition).content())
            .allSatisfy(item -> assertThat(item.tags()).contains("Nginx"));

        // 방문자 기준(공개 글만): Nginx 2건, 배포 1건(작성 중인 글은 빠짐), 성능 1건
        List<DocumentTagCountResponse> publicTags = documentService.getPopularTags(DocumentScope.HISTORY, OWNER_MEMBER_ID, DocumentStatus.PUBLISHED);
        assertThat(publicTags).first().isEqualTo(new DocumentTagCountResponse("Nginx", 2));
        assertThat(publicTags).contains(new DocumentTagCountResponse("배포", 1));
    }

    @Test
    void replacesTagsOnUpdateAndRejectsTooLongTag() {
        DocumentDetailResponse created = create("태그 교체", List.of("이전"), DocumentStatus.PUBLISHED);

        DocumentDetailResponse updated = documentService.updateDocument(created.documentId(), new DocumentUpdateRequest(
            "태그 교체", null, List.of(), List.of("새 태그"), objectMapper.createObjectNode().put("type", "doc"),
            "<p>내용</p>", "내용", DocumentStatus.PUBLISHED, created.versionNumber(), "태그 변경"), OWNER_MEMBER_ID, DocumentScope.HISTORY);

        assertThat(updated.tags()).containsExactly("새 태그");
        assertThatThrownBy(() -> create("긴 태그", List.of("#" + "가".repeat(21)), DocumentStatus.DRAFT))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("20자");
    }

    private DocumentDetailResponse create(String title, List<String> tags, DocumentStatus status) {
        return documentService.createDocument(new DocumentCreateRequest(
            title, null, List.of(), tags, objectMapper.createObjectNode().put("type", "doc"), "<p>내용</p>", "내용", status),
            OWNER_MEMBER_ID, DocumentScope.HISTORY);
    }

    private DocumentSearchCondition historyCondition() {
        DocumentSearchCondition condition = new DocumentSearchCondition();
        condition.setDocumentScope(DocumentScope.HISTORY);
        condition.setAuthorId(OWNER_MEMBER_ID);
        return condition;
    }
}
