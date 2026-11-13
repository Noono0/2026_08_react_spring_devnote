package com.example.devnote.board.service;

import com.example.devnote.DevNoteApplication;
import com.example.devnote.board.dto.BoardDtos.*;
import com.example.devnote.board.dto.CalendarHolidayDtos.HolidayRequest;
import com.example.devnote.board.dto.CalendarHolidayDtos.HolidayKind;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.core.io.FileSystemResource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import javax.sql.DataSource;

/** 실제 MySQL과 MyBatis Mapper로 게시판 CRUD, 기간 조회, 기존 날짜 마이그레이션을 확인한다. */
@SpringBootTest(classes = DevNoteApplication.class)
@AutoConfigureMockMvc
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
    @Autowired MockMvc mockMvc;
    @Autowired CalendarHolidayService calendarHolidayService;
    @Autowired com.example.devnote.board.dao.CalendarHolidayCacheDao holidayCacheDao;

    @BeforeAll static void migratesLegacySingleDateWithoutLosingThePost(
        @Autowired BoardService boardService, @Autowired JdbcTemplate jdbcTemplate,
        @Autowired DataSource dataSource, @Autowired ObjectMapper objectMapper
    ) throws Exception {
        // 이 클래스 전용 Testcontainers DB를 이전 스키마로 만든 뒤 실제 마이그레이션을 두 번 실행한다.
        LocalDate date = LocalDate.of(2020, 1, 15);
        PostRequest legacyInput = new PostRequest("기존 단일 날짜", objectMapper.createObjectNode().put("type", "doc"),
            "<p>일정 내용</p>", "일정 내용", null, false, null, date, null, null);
        PostDetail legacy = boardService.create(BoardType.CALENDAR, legacyInput, 2L);
        jdbcTemplate.execute("ALTER TABLE board_calendar_dates DROP COLUMN event_end_date");
        jdbcTemplate.execute("DROP TABLE board_popup_settings");
        jdbcTemplate.execute("DROP TABLE calendar_holidays");
        jdbcTemplate.execute("DROP TABLE calendar_holiday_cache");
        var migration = new FileSystemResource("../scripts/migrations/2026-11-13-board-calendar-period.sql");
        try (var connection = dataSource.getConnection()) {
            ScriptUtils.executeSqlScript(connection, migration);
            ScriptUtils.executeSqlScript(connection, migration);
            var popupMigration = new FileSystemResource("../scripts/migrations/2026-11-13-board-popups.sql");
            ScriptUtils.executeSqlScript(connection, popupMigration);
            ScriptUtils.executeSqlScript(connection, popupMigration);
            var holidayMigration = new FileSystemResource("../scripts/migrations/2026-11-13-calendar-holidays.sql");
            ScriptUtils.executeSqlScript(connection, holidayMigration);
            ScriptUtils.executeSqlScript(connection, holidayMigration);
            var cacheMigration = new FileSystemResource("../scripts/migrations/2026-11-13-calendar-holiday-cache.sql");
            ScriptUtils.executeSqlScript(connection, cacheMigration);
            ScriptUtils.executeSqlScript(connection, cacheMigration);
        }
        PostDetail restored = boardService.detail(BoardType.CALENDAR, legacy.postId(), 2L);
        assertThat(restored.title()).isEqualTo("기존 단일 날짜");
        assertThat(restored.eventDate()).isEqualTo(date);
        assertThat(restored.eventEndDate()).isEqualTo(date);
        boardService.delete(BoardType.CALENDAR, legacy.postId(), 2L);
    }

    @Test void persistsOfficialApiDataAcrossServiceInstancesAndUpdatesTheSameYear() throws Exception {
        var date = LocalDate.of(2040, 1, 1);
        var official = new com.example.devnote.board.dto.CalendarHolidayDtos.OfficialYear(2040, LocalDate.now(java.time.ZoneId.of("Asia/Seoul")),
            java.util.List.of(KoreanHolidayApiClient.SOURCE_URL), java.util.List.of(new com.example.devnote.board.dto.CalendarHolidayDtos.OfficialDay(date, "신정", HolidayKind.PUBLIC)));
        var row = new com.example.devnote.board.dao.CalendarHolidayCacheRow(2040, objectMapper.writeValueAsString(official), official.verifiedAt());
        holidayCacheDao.save(row);
        holidayCacheDao.save(row);
        assertThat(holidayCacheDao.years()).contains(2040);
        var restored = new KoreanHolidaySourceService(holidayCacheDao, org.mockito.Mockito.mock(KoreanHolidayApiClient.class), objectMapper).year(2040);
        assertThat(restored.source()).isEqualTo(com.example.devnote.board.dto.CalendarHolidayDtos.HolidaySource.CACHE);
        assertThat(restored.data().holidays()).hasSize(1);
        assertThat(holidayCacheDao.find(2040).contentJson()).contains("신정");
    }

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
            "<p>내용</p>", "내용", null, true, null, null, null, null);
        assertThat(boardService.create(BoardType.NOTICE, noticeRequest, 3L).pinned()).isTrue();
    }

    @Test void galleryImageAndEmbeddedEditorImageRemainAvailableAfterSave() {
        insertImage(9001L);
        PostRequest gallery = new PostRequest("사진", objectMapper.createObjectNode().put("type", "doc"),
            "<p>설명</p>", "설명", 9001L, false, null, null, null, null);
        PostDetail created = boardService.create(BoardType.GALLERY, gallery, 2L);
        assertThat(created.imageFileId()).isEqualTo(9001L);
        assertThat(boardService.list(BoardType.GALLERY, "", 0, 12).content()).hasSize(1);
        assertThat(fileStatus(9001L)).isEqualTo("ACTIVE");

        insertImage(9002L);
        var embeddedJson = objectMapper.createObjectNode().put("type", "doc");
        embeddedJson.putArray("content").addObject().put("type", "image").putObject("attrs")
            .put("src", "/api/v1/files/9002/content");
        boardService.create(BoardType.GENERAL,
            new PostRequest("본문 이미지", embeddedJson, "<p>본문</p>", "본문", null, false, null, null, null, null), 2L);
        assertThat(fileStatus(9002L)).isEqualTo("ACTIVE");
    }

    @Test void gridPostAndCalendarMonthUseTheSameDetailFlow() {
        PostDetail gridPost = boardService.create(BoardType.GRID, request("표로 볼 글", null), 2L);
        assertThat(boardService.list(BoardType.GRID, "표로", 0, 12).content())
            .extracting(PostSummary::postId).contains(gridPost.postId());

        LocalDate date = LocalDate.of(2026, 11, 12);
        PostRequest calendarInput = new PostRequest("일정", objectMapper.createObjectNode().put("type", "doc"),
            "<p>일정 내용</p>", "일정 내용", null, false, null, date, null, null);
        PostDetail calendarPost = boardService.create(BoardType.CALENDAR, calendarInput, 2L);
        assertThat(calendarPost.eventDate()).isEqualTo(date);
        assertThat(calendarPost.eventEndDate()).isEqualTo(date);
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 11), "").content())
            .extracting(PostSummary::postId).contains(calendarPost.postId());
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 12), "").content()).isEmpty();

        LocalDate moved = date.plusMonths(1);
        PostRequest movedInput = new PostRequest("일정 이동", objectMapper.createObjectNode().put("type", "doc"),
            "<p>일정 내용</p>", "일정 내용", null, false, calendarPost.versionNumber(), moved, moved, null);
        boardService.update(BoardType.CALENDAR, calendarPost.postId(), movedInput, 2L);
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 11), "").content()).isEmpty();
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 12), "").content())
            .extracting(PostSummary::eventDate).contains(moved);
        boardService.delete(BoardType.CALENDAR, calendarPost.postId(), 2L);
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 12), "").content()).isEmpty();
    }

    @Test void includesEveryMonthOverlappingAPeriodAndExcludesAdjacentMonths() {
        PostDetail period = boardService.create(BoardType.CALENDAR,
            calendarRequest("월 경계 행사", LocalDate.of(2026, 1, 31), LocalDate.of(2026, 3, 1), null), 2L);
        assertThat(period.eventEndDate()).isEqualTo(LocalDate.of(2026, 3, 1));
        for (int month : new int[] { 1, 2, 3 }) {
            var result = boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, month), "월 경계 행사");
            assertThat(result.content()).extracting(PostSummary::postId).containsExactly(period.postId());
            assertThat(result.content().getFirst().eventEndDate()).isEqualTo(LocalDate.of(2026, 3, 1));
            assertThat(result.truncated()).isFalse();
        }
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2025, 12), "월 경계 행사").content()).isEmpty();
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 4), "월 경계 행사").content()).isEmpty();
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 2), "일치하지 않음").content()).isEmpty();

        PostDetail moved = boardService.update(BoardType.CALENDAR, period.postId(),
            calendarRequest("월 경계 행사", LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 2), period.versionNumber()), 2L);
        assertThat(moved.eventDate()).isEqualTo(LocalDate.of(2026, 4, 1));
        assertThat(moved.eventEndDate()).isEqualTo(LocalDate.of(2026, 4, 2));
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 2), "월 경계 행사").content()).isEmpty();
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 4), "월 경계 행사").content())
            .extracting(PostSummary::postId).containsExactly(period.postId());
        boardService.delete(BoardType.CALENDAR, period.postId(), 2L);
        assertThat(boardService.calendarMonth(BoardType.CALENDAR, YearMonth.of(2026, 4), "월 경계 행사").content()).isEmpty();
    }

    @Test void noticePinnedOrderAndQuestionAnswerStateRemainDistinctFromGeneralPosts() {
        PostDetail regular = boardService.create(BoardType.NOTICE, request("고정하지 않은 공지", null), 3L);
        PostDetail pinned = boardService.create(BoardType.NOTICE,
            new PostRequest("고정 공지", objectMapper.createObjectNode().put("type", "doc"), "<p>본문</p>", "본문", null, true, null, null, null, null), 3L);
        assertThat(boardService.list(BoardType.NOTICE, "공지", 0, 12).content().getFirst().postId()).isEqualTo(pinned.postId());
        assertThat(boardService.detail(BoardType.NOTICE, regular.postId(), 2L).canEdit()).isFalse();
        PostDetail question = boardService.create(BoardType.QNA, request("답변 상태 질문", null), 2L);
        assertThat(question.answered()).isFalse();
        assertThat(boardService.detail(BoardType.QNA, question.postId(), 3L).canAnswer()).isTrue();
        assertThat(boardService.detail(BoardType.NOTICE, pinned.postId(), 3L).canAnswer()).isFalse();
    }

    private PostRequest calendarRequest(String title, LocalDate start, LocalDate end, Long version) {
        return new PostRequest(title, objectMapper.createObjectNode().put("type", "doc"),
            "<p>일정 내용</p>", "일정 내용", null, false, version, start, end, null);
    }

    @Test void communityCombinesExistingCategoriesWithPinnedOrderingAndServerPagination() {
        PostDetail general = boardService.create(BoardType.GENERAL, request("통합검증 일반", null), 2L);
        PostDetail question = boardService.create(BoardType.QNA, request("통합검증 질문", null), 2L);
        PostDetail notice = boardService.create(BoardType.NOTICE,
            new PostRequest("통합검증 공지", objectMapper.createObjectNode().put("type", "doc"), "<p>본문</p>", "본문",
                null, true, null, null, null, null), 3L);
        boardService.create(BoardType.CALENDAR,
            calendarRequest("통합검증 달력 제외", LocalDate.of(2031, 11, 13), LocalDate.of(2031, 11, 13), null), 2L);
        var all = boardService.listCommunity("", "통합검증", 0, 12);
        assertThat(all.content()).extracting(PostSummary::postId).containsExactly(notice.postId(), question.postId(), general.postId());
        assertThat(all.pageInformation().totalElements()).isEqualTo(3);
        assertThat(boardService.listCommunity("QNA", "통합검증", 0, 12).content())
            .extracting(PostSummary::postId).containsExactly(question.postId());
        var secondPage = boardService.listCommunity("", "통합검증", 1, 1);
        assertThat(secondPage.content()).extracting(PostSummary::postId).containsExactly(question.postId());
        assertThat(secondPage.pageInformation().totalElements()).isEqualTo(3);
    }

    @Test void popupTargetsExactMenusOrChildPathsAndRespectsInclusiveSchedule() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        PostDetail exact = boardService.create(BoardType.POPUP, popupRequest("팝업검증 해당 메뉴", "/popup-test", false, true, today, today, null), 3L);
        PostDetail children = boardService.create(BoardType.POPUP, popupRequest("팝업검증 하위 메뉴", "/popup-test", true, true, today, today, null), 3L);
        boardService.create(BoardType.POPUP, popupRequest("팝업검증 예약", "/popup-test", true, true, today.plusDays(1), today.plusDays(1), null), 3L);
        boardService.create(BoardType.POPUP, popupRequest("팝업검증 종료", "/popup-test", true, true, today.minusDays(1), today.minusDays(1), null), 3L);
        boardService.create(BoardType.POPUP, popupRequest("팝업검증 중지", "/popup-test", true, false, today, today, null), 3L);
        assertThat(boardService.activePopups(BoardType.POPUP, "/popup-test")).extracting(ActivePopup::postId)
            .containsExactly(children.postId(), exact.postId());
        assertThat(boardService.activePopups(BoardType.POPUP, "/popup-test/item")).extracting(ActivePopup::postId).containsExactly(children.postId());
        assertThat(boardService.activePopups(BoardType.POPUP, "/popup-test-other")).isEmpty();
        assertThat(boardService.list(BoardType.POPUP, "팝업검증", 0, 12, 3L).pageInformation().totalElements()).isEqualTo(5);
        assertThat(exact.popup().targetPath()).isEqualTo("/popup-test");
        PostDetail updated = boardService.update(BoardType.POPUP, exact.postId(),
            popupRequest("팝업검증 수정", "/popup-test", false, false, today, today, exact.versionNumber()), 3L);
        assertThat(updated.popup().enabled()).isFalse();
        assertThat(updated.versionNumber()).isEqualTo(exact.versionNumber() + 1);
        assertThat(boardService.activePopups(BoardType.POPUP, "/popup-test")).extracting(ActivePopup::postId).containsExactly(children.postId());
        boardService.delete(BoardType.POPUP, children.postId(), 3L);
        assertThat(boardService.activePopups(BoardType.POPUP, "/popup-test")).isEmpty();
        PostDetail root = boardService.create(BoardType.POPUP, popupRequest("전체 메뉴 검증", "/", true, true, today, today, null), 3L);
        assertThat(boardService.activePopups(BoardType.POPUP, "/any-menu")).extracting(ActivePopup::postId).containsExactly(root.postId());
        boardService.delete(BoardType.POPUP, root.postId(), 3L);
        PostDetail underscore = boardService.create(BoardType.POPUP, popupRequest("밑줄 경로 검증", "/menu_name", true, true, today, today, null), 3L);
        assertThat(boardService.activePopups(BoardType.POPUP, "/menu_name/item")).extracting(ActivePopup::postId).containsExactly(underscore.postId());
        assertThat(boardService.activePopups(BoardType.POPUP, "/menuXname/item")).isEmpty();
    }

    @Test void publicPopupApiReturnsOnlyActiveContentAndManagementRequiresLogin() throws Exception {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        boardService.create(BoardType.POPUP, popupRequest("공개 API 검증", "/api-test", false, true, today, today, null), 3L);
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/boards/POPUP/posts/active").param("path", "/api-test"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data[0].title").value("공개 API 검증"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data[0].contentHtml").value("<p>팝업 내용</p>"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data[0].endDate").value(today.toString()))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data[0].contentJson").doesNotExist());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/boards/POPUP/posts"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/boards/COMMUNITY/posts").param("category", "POPUP"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
    }

    private PostRequest popupRequest(String title, String path, boolean children, boolean enabled, LocalDate start, LocalDate end, Long version) {
        return new PostRequest(title, objectMapper.createObjectNode().put("type", "doc"), "<p>팝업 내용</p>", "팝업 내용",
            null, false, version, start, end, new PopupSettings(path, children, enabled));
    }

    @Test void customHolidaysPersistWithDuplicateAndVersionProtectionWithoutChangingOfficialData() {
        LocalDate date = LocalDate.of(2026, 11, 13);
        HolidayRequest input = new HolidayRequest(date, "관리자 지정 대체휴일", HolidayKind.SUBSTITUTE, null);
        var created = calendarHolidayService.create(input, 3L);
        assertThat(created.official()).isFalse();
        assertThat(created.versionNumber()).isEqualTo(1L);
        assertThat(calendarHolidayService.month("2026-11").content()).extracting(com.example.devnote.board.dto.CalendarHolidayDtos.Holiday::holidayId)
            .contains(created.holidayId());
        assertThatThrownBy(() -> calendarHolidayService.create(input, 3L))
            .extracting("errorCode").isEqualTo(com.example.devnote.common.exception.ErrorCode.CALENDAR_HOLIDAY_EXISTS);
        var updated = calendarHolidayService.update(created.holidayId(),
            new HolidayRequest(date.plusDays(1), "회사 창립기념일", HolidayKind.COMPANY, created.versionNumber()), 3L);
        assertThat(updated.date()).isEqualTo(date.plusDays(1));
        assertThat(updated.kind()).isEqualTo(HolidayKind.COMPANY);
        assertThat(updated.versionNumber()).isEqualTo(2L);
        assertThatThrownBy(() -> calendarHolidayService.delete(created.holidayId(), 1L, 3L))
            .extracting("errorCode").isEqualTo(com.example.devnote.common.exception.ErrorCode.CALENDAR_HOLIDAY_VERSION_CONFLICT);
        calendarHolidayService.delete(updated.holidayId(), updated.versionNumber(), 3L);
        assertThat(calendarHolidayService.month("2026-11").content()).noneMatch(day -> !day.official());
        assertThat(calendarHolidayService.month("2026-05").content()).hasSize(4).allMatch(com.example.devnote.board.dto.CalendarHolidayDtos.Holiday::official);
    }

    @Test void holidayApiIncludesSubstitutesAndRejectsNonAdministratorWritesAndInvalidDates() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/calendar/holidays").param("month", "2027-02"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data.officialDataAvailable").value(true))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data.content[3].date").value("2027-02-09"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data.content[3].kind").value("SUBSTITUTE"));
        String body = objectMapper.writeValueAsString(new HolidayRequest(LocalDate.of(2026, 11, 13), "휴일", HolidayKind.TEMPORARY, null));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/calendar/holidays")
            .header("X-Member-Id", "2").contentType("application/json").content(body))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/calendar/holidays")
            .header("X-Member-Id", "3").contentType("application/json").content(body.replace("2026-11-13", "2026-02-30")))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
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
            "<p>본문</p>", "본문", null, false, version, null, null, null);
    }
}
