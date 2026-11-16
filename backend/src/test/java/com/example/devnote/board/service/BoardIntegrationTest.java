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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.example.devnote.board.todo.dto.TodoDtos.TodoRequest;
import com.example.devnote.board.todo.dto.TodoDtos.GuestMergeRequest;
import com.example.devnote.board.todo.dao.TodoGuestRow;
import com.example.devnote.board.todo.service.TodoService;
import com.example.devnote.board.todo.domain.TodoOwner;
import com.example.devnote.board.todo.controller.TodoOwnerResolver;
import org.springframework.mock.web.MockCookie;
import jakarta.servlet.http.Cookie;
import com.example.devnote.member.service.AuthenticationService;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.http.MediaType;
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
    @Autowired TodoService todoService;

    private MockHttpSession todoSession(long memberId) {
        var session = new MockHttpSession();
        session.setAttribute(AuthenticationService.AUTHENTICATED_MEMBER_ID, memberId);
        return session;
    }

    private MockCookie todoGuest() throws Exception {
        var result = mockMvc.perform(get("/api/v1/board-todos/owner"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.mode").value("GUEST"))
            .andExpect(jsonPath("$.data.token").doesNotExist()).andExpect(jsonPath("$.data.tokenHash").doesNotExist())
            .andExpect(header().string("Cache-Control", "private, no-store")).andReturn();
        return MockCookie.parse(result.getResponse().getHeader("Set-Cookie"));
    }

    @Test void confirmedGuestMergePreservesExistingAccountTasksContentStateAndIdsWithoutDuplicates() throws Exception {
        var cookie = todoGuest();
        var existing = todoService.create(TodoOwner.member(2L), new TodoRequest("같은 제목의 할 일", "기존 계정 메모", false, null));
        var created = mockMvc.perform(post("/api/v1/board-todos").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new TodoRequest("같은 제목의 할 일", "비회원 메모", true, null))))
            .andExpect(status().isCreated()).andReturn();
        var before = objectMapper.readTree(created.getResponse().getContentAsString()).path("data");
        long id = before.path("todoId").asLong();
        var preview = mockMvc.perform(get("/api/v1/board-todos/guest-merge").session(todoSession(2L)).cookie(cookie))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(1)).andReturn();
        String key = objectMapper.readTree(preview.getResponse().getContentAsString()).path("data").path("guestKey").asText();
        long throughTodoId = objectMapper.readTree(preview.getResponse().getContentAsString()).path("data").path("throughTodoId").asLong();
        // 조회는 비회원 자료를 옮기지 않는다. 취소하는 경우에는 이 상태 그대로 남는다.
        mockMvc.perform(get("/api/v1/board-todos").cookie(cookie)).andExpect(jsonPath("$.data.pageInformation.totalElements").value(1));
        String input = objectMapper.writeValueAsString(new GuestMergeRequest(2L, key, throughTodoId));
        mockMvc.perform(post("/api/v1/board-todos/guest-merge").session(todoSession(2L)).cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(input))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.mergedCount").value(1));
        mockMvc.perform(get("/api/v1/board-todos/" + id).session(todoSession(2L)))
            .andExpect(jsonPath("$.data.content").value("비회원 메모")).andExpect(jsonPath("$.data.completed").value(true))
            .andExpect(jsonPath("$.data.createdAt").value(before.path("createdAt").asText())).andExpect(jsonPath("$.data.versionNumber").value(2));
        assertThat(todoService.detail(TodoOwner.member(2L), existing.todoId()).content()).isEqualTo("기존 계정 메모");
        mockMvc.perform(get("/api/v1/board-todos").cookie(cookie)).andExpect(jsonPath("$.data.pageInformation.totalElements").value(0));
        mockMvc.perform(get("/api/v1/board-todos/" + id).cookie(cookie)).andExpect(status().isNotFound());
        // 오래된 승인을 재전송해도 이후 새로 쓴 비회원 항목은 가져오지 않는다.
        mockMvc.perform(post("/api/v1/board-todos").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"승인 후 새 비회원 항목\",\"content\":\"남아 있어야 함\"}")).andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/board-todos/guest-merge").session(todoSession(2L)).cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(input))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.mergedCount").value(0));
        mockMvc.perform(get("/api/v1/board-todos").cookie(cookie)).andExpect(jsonPath("$.data.pageInformation.totalElements").value(1));
        assertThat(todoService.list(TodoOwner.member(2L), "ALL", "승인 후 새 비회원 항목", 0, 12).content()).isEmpty();
        assertThat(todoService.list(TodoOwner.member(2L), "ALL", "같은 제목의 할 일", 0, 12).content()).hasSize(2);
    }

    @Test void guestMergeRequiresCurrentLoginAndMatchingConfirmedBrowserAndAccount() throws Exception {
        var a = todoGuest(); var b = todoGuest();
        mockMvc.perform(post("/api/v1/board-todos").cookie(a).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"가져오기 계정 확인\",\"content\":\"비회원 메모\"}")).andExpect(status().isCreated());
        var preview = mockMvc.perform(get("/api/v1/board-todos/guest-merge").cookie(a).session(todoSession(2L))).andReturn();
        String key = objectMapper.readTree(preview.getResponse().getContentAsString()).path("data").path("guestKey").asText();
        long throughTodoId = objectMapper.readTree(preview.getResponse().getContentAsString()).path("data").path("throughTodoId").asLong();
        String input = objectMapper.writeValueAsString(new GuestMergeRequest(2L, key, throughTodoId));
        mockMvc.perform(get("/api/v1/board-todos/guest-merge").cookie(a)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/board-todos/guest-merge").cookie(a).contentType(MediaType.APPLICATION_JSON).content(input)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/board-todos/guest-merge").cookie(a).session(todoSession(3L)).contentType(MediaType.APPLICATION_JSON).content(input))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("TODO_MERGE_CONTEXT_CHANGED"));
        mockMvc.perform(post("/api/v1/board-todos/guest-merge").cookie(b).session(todoSession(2L)).contentType(MediaType.APPLICATION_JSON).content(input))
            .andExpect(status().isConflict());
        mockMvc.perform(post("/api/v1/board-todos/guest-merge").session(todoSession(2L)).contentType(MediaType.APPLICATION_JSON).content(input))
            .andExpect(status().isConflict());
        mockMvc.perform(get("/api/v1/board-todos/guest-merge").session(todoSession(2L)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.count").value(0));
        mockMvc.perform(get("/api/v1/board-todos").cookie(a)).andExpect(jsonPath("$.data.pageInformation.totalElements").value(1));
    }

    @Test void simultaneousGuestMergesTransferEachRowToExactlyOneAccount() throws Exception {
        var cookie = todoGuest();
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/v1/board-todos").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new TodoRequest("동시 가져오기 " + i, "보존", false, null)))).andExpect(status().isCreated());
        }
        var preview = mockMvc.perform(get("/api/v1/board-todos/guest-merge").session(todoSession(2L)).cookie(cookie)).andReturn();
        String key = objectMapper.readTree(preview.getResponse().getContentAsString()).path("data").path("guestKey").asText();
        long throughTodoId = objectMapper.readTree(preview.getResponse().getContentAsString()).path("data").path("throughTodoId").asLong();
        TodoGuestRow guest = new TodoGuestRow();
        guest.setPublicId(key.substring(6));
        guest.setGuestId(jdbcTemplate.queryForObject("SELECT guest_id FROM board_todo_guests WHERE public_id = ?", Long.class, guest.getPublicId()));
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { start.await(); return todoService.mergeGuest(2L, guest, new GuestMergeRequest(2L, key, throughTodoId)).mergedCount(); });
            var second = executor.submit(() -> { start.await(); return todoService.mergeGuest(3L, guest, new GuestMergeRequest(3L, key, throughTodoId)).mergedCount(); });
            start.countDown();
            int a = first.get(10, java.util.concurrent.TimeUnit.SECONDS), b = second.get(10, java.util.concurrent.TimeUnit.SECONDS);
            assertThat(a + b).isEqualTo(3);
            assertThat(a == 0 || b == 0).isTrue();
        }
        mockMvc.perform(get("/api/v1/board-todos").cookie(cookie)).andExpect(jsonPath("$.data.pageInformation.totalElements").value(0));
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM board_todos WHERE title LIKE '동시 가져오기 %'", Long.class)).isEqualTo(3);
    }

    @Test void guestCookieIsPrivatePersistentAndOnlyHashedInTheDatabase() throws Exception {
        MockCookie cookie = todoGuest();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getPath()).isEqualTo(TodoOwnerResolver.COOKIE_PATH);
        assertThat(cookie.getDomain()).isNull();
        assertThat(cookie.getSameSite()).isEqualTo("Strict");
        assertThat(cookie.getMaxAge()).isEqualTo(365 * 24 * 60 * 60);
        assertThat(cookie.getValue()).matches("[A-Za-z0-9_-]{43}");
        var first = mockMvc.perform(get("/api/v1/board-todos/owner").cookie(cookie)).andReturn();
        var second = mockMvc.perform(get("/api/v1/board-todos/owner").cookie(cookie)).andReturn();
        String cacheKey = objectMapper.readTree(first.getResponse().getContentAsString()).path("data").path("cacheKey").asText();
        assertThat(objectMapper.readTree(second.getResponse().getContentAsString()).path("data").path("cacheKey").asText()).isEqualTo(cacheKey);
        assertThat(first.getResponse().getContentAsString()).doesNotContain(cookie.getValue());
        String hash = jdbcTemplate.queryForObject("SELECT token_hash FROM board_todo_guests WHERE public_id = ?", String.class, cacheKey.substring(6));
        assertThat(hash).hasSize(64).isNotEqualTo(cookie.getValue());
    }

    @Test void guestsOnlySeeTheirOwnTodosAndCannotReadEditOrDeleteAnotherBrowsersTodo() throws Exception {
        var a = todoGuest(); var b = todoGuest();
        String body = objectMapper.writeValueAsString(new TodoRequest("비회원 분리 첫 글", "비공개 메모", false, null));
        var created = mockMvc.perform(post("/api/v1/board-todos").cookie(a).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andReturn();
        long id = objectMapper.readTree(created.getResponse().getContentAsString()).path("data").path("todoId").asLong();
        mockMvc.perform(get("/api/v1/board-todos").cookie(a)).andExpect(jsonPath("$.data.pageInformation.totalElements").value(1));
        mockMvc.perform(get("/api/v1/board-todos").cookie(b).param("guestId", "1").header("X-Member-Id", "2"))
            .andExpect(jsonPath("$.data.pageInformation.totalElements").value(0));
        for (var session : new MockHttpSession[]{todoSession(1L), todoSession(2L), todoSession(3L)}) {
            mockMvc.perform(get("/api/v1/board-todos/" + id).session(session).cookie(a)).andExpect(status().isNotFound());
        }
        mockMvc.perform(get("/api/v1/board-todos/" + id).cookie(b)).andExpect(status().isNotFound());
        String update = objectMapper.writeValueAsString(new TodoRequest("다른 사람 수정", "메모", true, 1L));
        mockMvc.perform(put("/api/v1/board-todos/" + id).cookie(b).contentType(MediaType.APPLICATION_JSON).content(update)).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/board-todos/" + id).cookie(b).param("versionNumber", "1")).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/v1/board-todos/" + id).cookie(a).contentType(MediaType.APPLICATION_JSON).content(update))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.completed").value(true));
        mockMvc.perform(get("/api/v1/board-todos").cookie(a).param("status", "DONE").param("keyword", "다른 사람"))
            .andExpect(jsonPath("$.data.pageInformation.totalElements").value(1));
        mockMvc.perform(delete("/api/v1/board-todos/" + id).cookie(a).param("versionNumber", "1")).andExpect(status().isConflict());
        mockMvc.perform(delete("/api/v1/board-todos/" + id).cookie(a).param("versionNumber", "2")).andExpect(status().isNoContent());
    }

    @Test void guestCookieAndMemberSessionKeepSeparateListsAcrossLoginAndLogout() throws Exception {
        var guest = todoGuest();
        String body = objectMapper.writeValueAsString(new TodoRequest("로그인 전후 게스트", "메모", false, null));
        mockMvc.perform(post("/api/v1/board-todos").cookie(guest).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/board-todos").cookie(guest).session(todoSession(2L)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"로그인 전후 회원\",\"content\":\"메모\",\"guestId\":1}" )).andExpect(status().isCreated());
        mockMvc.perform(get("/api/v1/board-todos/owner").cookie(guest).session(todoSession(2L)))
            .andExpect(jsonPath("$.data.mode").value("MEMBER")).andExpect(jsonPath("$.data.cacheKey").value("member:2"));
        mockMvc.perform(get("/api/v1/board-todos").cookie(guest).session(todoSession(2L)).param("keyword", "로그인 전후"))
            .andExpect(jsonPath("$.data.pageInformation.totalElements").value(1)).andExpect(jsonPath("$.data.content[0].title").value("로그인 전후 회원"));
        mockMvc.perform(get("/api/v1/board-todos").cookie(guest).param("keyword", "로그인 전후"))
            .andExpect(jsonPath("$.data.pageInformation.totalElements").value(1)).andExpect(jsonPath("$.data.content[0].title").value("로그인 전후 게스트"));
        mockMvc.perform(get("/api/v1/board-todos").cookie(todoGuest()).param("keyword", "로그인 전후"))
            .andExpect(jsonPath("$.data.pageInformation.totalElements").value(0));
    }

    @Test void missingForgedMalformedAndDuplicateGuestCookiesCannotAccessOrCreateTodos() throws Exception {
        String body = objectMapper.writeValueAsString(new TodoRequest("쿠키 누락 방지", "메모", false, null));
        for (String value : new String[]{"A".repeat(43), "invalid", "", "guest:11111111-1111-4111-8111-111111111111"}) {
            Cookie cookie = new Cookie(TodoOwnerResolver.COOKIE_NAME, value);
            mockMvc.perform(post("/api/v1/board-todos").cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("TODO_GUEST_COOKIE_REQUIRED"));
        }
        var a = todoGuest(); var b = todoGuest();
        mockMvc.perform(get("/api/v1/board-todos").cookie(a, b)).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/board-todos").param("keyword", "쿠키 누락 방지").cookie(todoGuest()))
            .andExpect(jsonPath("$.data.pageInformation.totalElements").value(0));
    }

    @Test void todoIsPrivateEvenFromAdministratorsAndCannotBeSpoofedWithHeaders() throws Exception {
        var own = todoService.create(TodoOwner.member(2L), new TodoRequest("TODO 격리 내 할 일", "개인 메모", false, null));
        todoService.create(TodoOwner.member(3L), new TodoRequest("TODO 격리 관리자 할 일", "관리자 메모", false, null));
        todoService.create(TodoOwner.member(1L), new TodoRequest("TODO 격리 최고관리자 할 일", "최고관리자 메모", false, null));
        for (long memberId : new long[]{1L, 2L, 3L}) {
            mockMvc.perform(get("/api/v1/board-todos").session(todoSession(memberId)).param("keyword", "TODO 격리"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.pageInformation.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].authorId").doesNotExist());
        }
        String input = objectMapper.writeValueAsString(new TodoRequest("유출 시도", "변경 시도", true, own.versionNumber()));
        for (long outsider : new long[]{1L, 3L}) {
            var session = todoSession(outsider);
            mockMvc.perform(get("/api/v1/board-todos/" + own.todoId()).session(session).header("X-Member-Id", "2"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.errorCode").value("TODO_NOT_FOUND"));
            mockMvc.perform(put("/api/v1/board-todos/" + own.todoId()).session(session).contentType(MediaType.APPLICATION_JSON).content(input))
                .andExpect(status().isNotFound());
            mockMvc.perform(delete("/api/v1/board-todos/" + own.todoId()).session(session).param("versionNumber", "1"))
                .andExpect(status().isNotFound());
        }
        assertThat(todoService.detail(TodoOwner.member(2L), own.todoId()).content()).isEqualTo("개인 메모");
        mockMvc.perform(get("/api/v1/boards/COMMUNITY/posts").param("keyword", "TODO 격리"))
            .andExpect(jsonPath("$.data.pageInformation.totalElements").value(0));
    }

    @Test void todoRequiresCookieHandshakeForGuestsAndIgnoresDevelopmentHeaders() throws Exception {
        String input = objectMapper.writeValueAsString(new TodoRequest("로그인 필요", "메모", false, 1L));
        mockMvc.perform(get("/api/v1/board-todos").header("X-Member-Id", "2")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/board-todos/1").header("X-Member-Id", "2")).andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/board-todos").header("X-Member-Id", "2").contentType(MediaType.APPLICATION_JSON).content(input))
            .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/v1/board-todos/1").header("X-Member-Id", "2").contentType(MediaType.APPLICATION_JSON).content(input))
            .andExpect(status().isBadRequest());
        mockMvc.perform(delete("/api/v1/board-todos/1").header("X-Member-Id", "2").param("versionNumber", "1"))
            .andExpect(status().isBadRequest());
    }

    @Test void todoSearchStatePaginationAndCountsAreScopedToTheAuthor() throws Exception {
        todoService.create(TodoOwner.member(2L), new TodoRequest("TODO 페이지 첫 번째", "메모", false, null));
        todoService.create(TodoOwner.member(2L), new TodoRequest("TODO 페이지 두 번째", "메모", false, null));
        todoService.create(TodoOwner.member(2L), new TodoRequest("TODO 페이지 완료", "메모", true, null));
        todoService.create(TodoOwner.member(3L), new TodoRequest("TODO 페이지 다른 사람", "메모", false, null));
        mockMvc.perform(get("/api/v1/board-todos").session(todoSession(2L)).param("keyword", "TODO 페이지")
                .param("status", "ACTIVE").param("pageSize", "1").param("pageNumber", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].completed").value(false))
            .andExpect(jsonPath("$.data.pageInformation.totalElements").value(2))
            .andExpect(jsonPath("$.data.pageInformation.totalPages").value(2));
        assertThat(todoService.list(TodoOwner.member(2L), "DONE", "TODO 페이지", 0, 12).content()).hasSize(1);
    }

    @Test void todoCompletionUpdatesAndDeletionUseOptimisticVersions() throws Exception {
        var created = todoService.create(TodoOwner.member(2L), new TodoRequest("버전 검증", "내용", false, null));
        var session = todoSession(2L);
        String body = objectMapper.writeValueAsString(new TodoRequest("수정된 할 일", "수정 메모", true, created.versionNumber()));
        mockMvc.perform(put("/api/v1/board-todos/" + created.todoId()).session(session).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.completed").value(true))
            .andExpect(jsonPath("$.data.versionNumber").value(2));
        mockMvc.perform(put("/api/v1/board-todos/" + created.todoId()).session(session).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isConflict());
        mockMvc.perform(delete("/api/v1/board-todos/" + created.todoId()).session(session).param("versionNumber", "1"))
            .andExpect(status().isConflict());
        mockMvc.perform(delete("/api/v1/board-todos/" + created.todoId()).session(session).param("versionNumber", "2"))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/board-todos/" + created.todoId()).session(session)).andExpect(status().isNotFound());
    }

    @Test void todoUsesSessionAuthorAndValidatesInputs() throws Exception {
        var session = todoSession(2L);
        var result = mockMvc.perform(post("/api/v1/board-todos").session(session).header("X-Member-Id", "3")
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"작성자 위조 검증\",\"content\":\"메모\",\"authorId\":3}"))
            .andExpect(status().isCreated()).andReturn();
        long todoId = objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("todoId").asLong();
        assertThat(todoService.detail(TodoOwner.member(2L), todoId).title()).isEqualTo("작성자 위조 검증");
        mockMvc.perform(get("/api/v1/board-todos/" + todoId).session(todoSession(3L))).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/board-todos").session(session).contentType(MediaType.APPLICATION_JSON).content("{\"title\":\" \",\"content\":\"\"}"))
            .andExpect(status().isBadRequest());
        for (String state : new String[]{"INVALID", ""}) {
            mockMvc.perform(get("/api/v1/board-todos").session(session).param("status", state)).andExpect(state.isEmpty() ? status().isOk() : status().isBadRequest());
        }
        mockMvc.perform(get("/api/v1/board-todos").session(session).param("pageSize", "51")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/board-todos").session(session).param("pageNumber", "-1")).andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/v1/board-todos/" + todoId).session(session).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"제목\",\"content\":\"메모\"}")).andExpect(status().isBadRequest());
    }

    @Test void todoMigrationCanBeReappliedWithoutLosingPrivatePosts(@Autowired DataSource dataSource) throws Exception {
        var todo = todoService.create(TodoOwner.member(2L), new TodoRequest("마이그레이션 보존", "개인 메모", false, null));
        try (var connection = dataSource.getConnection()) {
            var migration = new FileSystemResource("../scripts/migrations/2026-11-16-board-todos.sql");
            ScriptUtils.executeSqlScript(connection, migration);
            ScriptUtils.executeSqlScript(connection, migration);
        }
        assertThat(todoService.detail(TodoOwner.member(2L), todo.todoId()).content()).isEqualTo("개인 메모");
    }
    @Autowired CalendarHolidayService calendarHolidayService;
    @Autowired com.example.devnote.board.dao.CalendarHolidayCacheDao holidayCacheDao;

    @BeforeAll static void migratesLegacySingleDateWithoutLosingThePost(
        @Autowired BoardService boardService, @Autowired JdbcTemplate jdbcTemplate,
        @Autowired DataSource dataSource, @Autowired ObjectMapper objectMapper, @Autowired TodoService todoService
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
        var legacyTodo = todoService.create(TodoOwner.member(2L), new TodoRequest("기존 회원 TODO", "보존할 메모", false, null));
        jdbcTemplate.execute("DROP TABLE board_todo_push_deliveries");
        jdbcTemplate.execute("DROP TABLE board_todo_push_subscriptions");
        jdbcTemplate.execute("ALTER TABLE board_todos DROP CHECK ck_board_todo_owner, DROP FOREIGN KEY fk_board_todo_guest, DROP INDEX idx_board_todo_guest_state, DROP COLUMN guest_id, MODIFY COLUMN author_id BIGINT NOT NULL");
        jdbcTemplate.execute("DROP TABLE board_todo_guests");
        try (var connection = dataSource.getConnection()) {
            var guestMigration = new FileSystemResource("../scripts/migrations/2026-11-16-todo-guests.sql");
            ScriptUtils.executeSqlScript(connection, guestMigration);
            ScriptUtils.executeSqlScript(connection, guestMigration);
            var pushMigration = new FileSystemResource("../scripts/migrations/2026-11-16-todo-web-push.sql");
            ScriptUtils.executeSqlScript(connection, pushMigration);
            ScriptUtils.executeSqlScript(connection, pushMigration);
        }
        assertThat(todoService.detail(TodoOwner.member(2L), legacyTodo.todoId()).content()).isEqualTo("보존할 메모");
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
