package com.example.devnote.board.service;

import com.example.devnote.DevNoteApplication;
import com.example.devnote.board.dto.BoardDtos.*;
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

import static org.assertj.core.api.Assertions.assertThat;
import java.time.LocalDate;
import java.time.YearMonth;

/** 실제 MySQL과 MyBatis Mapper로 네 게시판의 공통 CRUD 및 Q&A 답변 흐름을 확인한다. */
@SpringBootTest(classes = DevNoteApplication.class)
@ActiveProfiles("test")
@Testcontainers
class BoardIntegrationTest {
    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
        .withDatabaseName("devnote_board_test").withUsername("devnote").withPassword("devnote");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired BoardService boardService;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbcTemplate;

    @Test void createsSearchesUpdatesAndDeletesGeneralPost() {
        PostDetail created = boardService.create(BoardType.GENERAL, request("검색할 제목", null), 2L);
        assertThat(boardService.list(BoardType.GENERAL, "검색할", 0, 12).content())
            .extracting(PostSummary::postId).contains(created.postId());
        assertThat(boardService.detail(BoardType.GENERAL, created.postId(), 2L).viewCount()).isEqualTo(1);

        PostDetail updated = boardService.update(BoardType.GENERAL, created.postId(), request("수정 제목", created.versionNumber()), 2L);
        assertThat(updated.title()).isEqualTo("수정 제목");
        assertThat(updated.versionNumber()).isEqualTo(created.versionNumber() + 1);
        boardService.delete(BoardType.GENERAL, created.postId(), 2L);
        assertThat(boardService.list(BoardType.GENERAL, "수정", 0, 12).content()).isEmpty();
    }

    @Test void answersQuestionAndPinsNotice() {
        PostDetail question = boardService.create(BoardType.QNA, request("질문", null), 2L);
        AnswerRequest answer = new AnswerRequest(objectMapper.createObjectNode().put("type", "doc"), "<p>답변</p>", "답변");
        PostDetail answered = boardService.answer(BoardType.QNA, question.postId(), answer, 3L);
        assertThat(answered.answered()).isTrue();
        assertThat(answered.answer().contentHtml()).isEqualTo("<p>답변</p>");
        boardService.deleteAnswer(BoardType.QNA, question.postId(), 3L);
        assertThat(boardService.detail(BoardType.QNA, question.postId(), 2L).answered()).isFalse();

        PostRequest noticeRequest = new PostRequest("공지", objectMapper.createObjectNode().put("type", "doc"),
            "<p>내용</p>", "내용", null, true, null, null);
        assertThat(boardService.create(BoardType.NOTICE, noticeRequest, 3L).pinned()).isTrue();
    }

    @Test void galleryImageAndEmbeddedEditorImageRemainAvailableAfterSave() {
        insertImage(9001L);
        PostRequest gallery = new PostRequest("사진", objectMapper.createObjectNode().put("type", "doc"),
            "<p>설명</p>", "설명", 9001L, false, null, null);
        PostDetail created = boardService.create(BoardType.GALLERY, gallery, 2L);
        assertThat(created.imageFileId()).isEqualTo(9001L);
        assertThat(boardService.list(BoardType.GALLERY, "", 0, 12).content()).hasSize(1);
        assertThat(fileStatus(9001L)).isEqualTo("ACTIVE");

        insertImage(9002L);
        var embeddedJson = objectMapper.createObjectNode().put("type", "doc");
        embeddedJson.putArray("content").addObject().put("type", "image").putObject("attrs")
            .put("src", "/api/v1/files/9002/content");
        boardService.create(BoardType.GENERAL,
            new PostRequest("본문 이미지", embeddedJson, "<p>본문</p>", "본문", null, false, null, null), 2L);
        assertThat(fileStatus(9002L)).isEqualTo("ACTIVE");
    }

    @Test void gridPostAndCalendarMonthUseTheSameDetailFlow() {
        PostDetail gridPost = boardService.create(BoardType.GRID, request("표로 볼 글", null), 2L);
        assertThat(boardService.list(BoardType.GRID, "표로", 0, 12).content())
            .extracting(PostSummary::postId).contains(gridPost.postId());

        LocalDate date = LocalDate.of(2026, 11, 12);
        PostRequest calendarInput = new PostRequest("일정", objectMapper.createObjectNode().put("type", "doc"),
            "<p>일정 내용</p>", "일정 내용", null, false, null, date);
        PostDetail calendarPost = boardService.create(BoardType.CALENDAR, calendarInput, 2L);
        assertThat(calendarPost.eventDate()).isEqualTo(date);
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 11), "").content())
            .extracting(PostSummary::postId).contains(calendarPost.postId());
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 12), "").content()).isEmpty();

        LocalDate moved = date.plusMonths(1);
        PostRequest movedInput = new PostRequest("일정 이동", objectMapper.createObjectNode().put("type", "doc"),
            "<p>일정 내용</p>", "일정 내용", null, false, calendarPost.versionNumber(), moved);
        boardService.update(BoardType.CALENDAR, calendarPost.postId(), movedInput, 2L);
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 11), "").content()).isEmpty();
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 12), "").content())
            .extracting(PostSummary::eventDate).contains(moved);
        boardService.delete(BoardType.CALENDAR, calendarPost.postId(), 2L);
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 12), "").content()).isEmpty();
    }

    private void insertImage(long id) {
        jdbcTemplate.update("""
            INSERT INTO file_resources
                (file_id, uploader_id, original_file_name, stored_file_name, file_extension, mime_type, file_size, storage_path, file_status)
            VALUES (?, 2, 'image.png', 'stored.png', 'png', 'image/png', 123, '/tmp/stored.png', 'TEMP')
            """, id);
    }

    private String fileStatus(long id) {
        return jdbcTemplate.queryForObject("SELECT file_status FROM file_resources WHERE file_id = ?", String.class, id);
    }

    private PostRequest request(String title, Long version) {
        return new PostRequest(title, objectMapper.createObjectNode().put("type", "doc"),
            "<p>본문</p>", "본문", null, false, version, null);
    }
}
