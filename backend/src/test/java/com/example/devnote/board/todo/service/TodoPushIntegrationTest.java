package com.example.devnote.board.todo.service;

import com.example.devnote.DevNoteApplication;
import com.example.devnote.board.todo.dao.TodoPushDao;
import com.example.devnote.board.todo.dao.TodoPushDeliveryRow;
import com.example.devnote.board.todo.domain.TodoOwner;
import com.example.devnote.board.todo.dto.TodoDtos.*;
import com.example.devnote.member.service.AuthenticationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.mock.web.MockCookie;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = DevNoteApplication.class) @AutoConfigureMockMvc @ActiveProfiles("test") @Testcontainers
class TodoPushIntegrationTest {
    @Container static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
        .withDatabaseName("devnote_push_test").withUsername("devnote").withPassword("devnote");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl); registry.add("spring.datasource.username", MYSQL::getUsername); registry.add("spring.datasource.password", MYSQL::getPassword);
    }
    @Autowired TodoService todos;
    @Autowired TodoPushDispatcher dispatcher;
    @Autowired TodoPushDao push;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired DataSource dataSource;
    @MockitoBean WebPushTransport transport;

    private Instant time;
    private LocalDateTime due;
    private MockHttpSession session(long memberId) {
        var session = new MockHttpSession(); session.setAttribute(AuthenticationService.AUTHENTICATED_MEMBER_ID, memberId); return session;
    }
    @BeforeEach void setup() throws Exception {
        jdbc.update("DELETE FROM board_todos"); jdbc.update("DELETE FROM board_todo_push_subscriptions");
        when(transport.configured()).thenReturn(true); when(transport.publicKey()).thenReturn("B" + "A".repeat(86)); when(transport.send(any())).thenReturn(201);
        time = Instant.now().plusSeconds(120).truncatedTo(ChronoUnit.SECONDS); due = LocalDateTime.ofInstant(time.plusSeconds(1), ZoneOffset.UTC);
    }
    private Todo create() { return todos.create(TodoOwner.member(2L), new TodoRequest("알림 TODO", "비공개 메모", false, null, List.of(time))); }
    private Cookie device(MockHttpSession session, String suffix) throws Exception {
        var response = mvc.perform(get("/api/v1/board-todos/push").session(session)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.configured").value(true)).andExpect(header().string("Cache-Control", "private, no-store")).andReturn();
        var cookie = MockCookie.parse(response.getResponse().getHeader("Set-Cookie"));
        assertThat(cookie.isHttpOnly()).isTrue(); assertThat(cookie.getPath()).isEqualTo("/api/v1");
        mvc.perform(post("/api/v1/board-todos/push/subscription").session(session).cookie(cookie).contentType(MediaType.APPLICATION_JSON)
            .content("{\"expectedOwnerKey\":\"member:2\",\"endpoint\":\"https://fcm.googleapis.com/wp/" + suffix + "\"}"))
            .andExpect(status().isNoContent()); return cookie;
    }
    @Test void persistsSeveralUtcTimesPreservesSentTimesAndValidatesNewTimes() throws Exception {
        var row = todos.create(TodoOwner.member(2L), new TodoRequest("여러 알림", "", false, null, List.of(time, time.plusSeconds(3600))));
        assertThat(row.reminders()).extracting(Reminder::scheduledAt).containsExactly(time, time.plusSeconds(3600));
        var changed = todos.update(TodoOwner.member(2L), row.todoId(), new TodoRequest("변경", "", false, row.versionNumber(), List.of(time.plusSeconds(3600))));
        assertThat(changed.reminders()).hasSize(1);
        assertThatThrownBy(() -> todos.update(TodoOwner.member(2L), row.todoId(), new TodoRequest("불가", "", false, changed.versionNumber(), List.of(time, time)))).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> todos.create(TodoOwner.member(2L), new TodoRequest("과거", "", false, null, List.of(Instant.now().minusSeconds(1))))).isInstanceOf(RuntimeException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_todos", Long.class)).isEqualTo(1);
        mvc.perform(post("/api/v1/board-todos").session(session(2)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"title\":\"너무 많은 알림\",\"content\":\"\",\"reminderTimes\":" + json.writeValueAsString(java.util.Collections.nCopies(21, time)) + "}"))
            .andExpect(status().isBadRequest());
    }
    @Test void sendsEachReminderToEachOwnedDeviceOnceAcrossRepeatedScans() throws Exception {
        var row = create(); var own = session(2); device(own, "desktop"); device(own, "mobile");
        dispatcher.dispatchAt(due.minusSeconds(2)); verify(transport, never()).send(any());
        dispatcher.dispatchAt(due); dispatcher.dispatchAt(due.plusSeconds(10));
        var sent = ArgumentCaptor.forClass(TodoPushDeliveryRow.class); verify(transport, times(2)).send(sent.capture());
        assertThat(sent.getAllValues()).extracting(TodoPushDeliveryRow::getSubscriptionId).doesNotHaveDuplicates();
        assertThat(todos.detail(TodoOwner.member(2L), row.todoId()).reminders().getFirst().status()).isEqualTo("SENT");
    }
    @Test void completionAndDeletionStopPendingDeliveryAndOldVersionsDoNotReplaceReminders() throws Exception {
        var row = create(); device(session(2), "completion");
        var completed = todos.update(TodoOwner.member(2L), row.todoId(), new TodoRequest(row.title(), row.content(), true, row.versionNumber()));
        assertThat(completed.reminders().getFirst().status()).isEqualTo("CANCELLED");
        assertThatThrownBy(() -> todos.update(TodoOwner.member(2L), row.todoId(), new TodoRequest("stale", "", false, 1L, List.of(time.plusSeconds(300))))).isInstanceOf(RuntimeException.class);
        dispatcher.dispatchAt(due); verify(transport, never()).send(any());
        var deleted = create(); todos.delete(TodoOwner.member(2L), deleted.todoId(), deleted.versionNumber());
        dispatcher.dispatchAt(due); verify(transport, never()).send(any());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_todo_reminders WHERE todo_id = ?", Long.class, deleted.todoId())).isZero();
    }
    @Test void retriesTransientFailuresAndDisablesExpiredSubscriptions() throws Exception {
        var row = create(); device(session(2), "retry"); when(transport.send(any())).thenReturn(503, 201);
        dispatcher.dispatchAt(due); dispatcher.dispatchAt(due.plusSeconds(30)); verify(transport, times(1)).send(any());
        dispatcher.dispatchAt(due.plusSeconds(61)); verify(transport, times(2)).send(any());
        assertThat(todos.detail(TodoOwner.member(2L), row.todoId()).reminders().getFirst().status()).isEqualTo("SENT");
        var expired = create(); when(transport.send(any())).thenReturn(410);
        dispatcher.dispatchAt(due.plusSeconds(62));
        assertThat(todos.detail(TodoOwner.member(2L), expired.todoId()).reminders().getFirst().status()).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("SELECT enabled FROM board_todo_push_subscriptions", Boolean.class)).isFalse();
    }
    @Test void unsubscribingAndLogoutRemoveOnlyThisDeviceAndRejectChangedAccounts() throws Exception {
        var own = session(2); var first = device(own, "first"); var second = device(own, "second");
        mvc.perform(delete("/api/v1/board-todos/push/subscription").session(session(3)).cookie(first).param("expectedOwnerKey", "member:2"))
            .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_todo_push_subscriptions", Long.class)).isEqualTo(2);
        mvc.perform(delete("/api/v1/board-todos/push/subscription").session(own).cookie(first).param("expectedOwnerKey", "member:2")).andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/auth/session").session(own).cookie(second)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_todo_push_subscriptions", Long.class)).isZero();
    }
    @Test void guestMergePreservesSchedulesAndRebindsFutureDeliveryToTheMember() throws Exception {
        var init = mvc.perform(get("/api/v1/board-todos/owner")).andReturn();
        var cookie = MockCookie.parse(init.getResponse().getHeader("Set-Cookie"));
        var ownerData = json.readTree(init.getResponse().getContentAsString()).path("data"); String guestKey = ownerData.path("cacheKey").asText();
        long guestId = jdbc.queryForObject("SELECT guest_id FROM board_todo_guests WHERE public_id = ?", Long.class, guestKey.substring(6));
        var row = todos.create(TodoOwner.guest(guestId), new TodoRequest("손님 예약", "", false, null, List.of(time)));
        var member = session(2); device(member, "member-device");
        var guest = new com.example.devnote.board.todo.dao.TodoGuestRow(); guest.setGuestId(guestId); guest.setPublicId(guestKey.substring(6));
        var preview = todos.previewMerge(2, guest);
        mvc.perform(post("/api/v1/board-todos/guest-merge").session(member).cookie(cookie).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(new GuestMergeRequest(2L, guestKey, preview.throughTodoId())))).andExpect(status().isOk());
        assertThat(todos.detail(TodoOwner.member(2L), row.todoId()).reminders().getFirst().scheduledAt()).isEqualTo(time);
        dispatcher.dispatchAt(due); verify(transport, times(1)).send(any());
        mvc.perform(get("/api/v1/board-todos/" + row.todoId()).cookie(cookie)).andExpect(status().isNotFound());
    }
    @Test void claimsAreAtomicAndExpiredLeasesCanBeRecovered() throws Exception {
        create(); device(session(2), "atomic"); push.enqueue(due, due.minusDays(1)); long id = push.due(due).getFirst();
        var start = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { start.await(); return push.claim(id, due, due.plusMinutes(2), "first"); });
            var second = executor.submit(() -> { start.await(); return push.claim(id, due, due.plusMinutes(2), "second"); });
            assertThat(first.get() + second.get()).isEqualTo(1);
        }
        assertThat(push.claim(id, due.plusMinutes(3), due.plusMinutes(5), "recovered")).isEqualTo(1);
        assertThat(push.target(id, "first")).isNull(); assertThat(push.target(id, "recovered")).isNotNull();
        assertThat(push.claim(id, due.plusMinutes(6), due.plusMinutes(8), "third")).isEqualTo(1);
        dispatcher.dispatchAt(due.plusMinutes(9)); verify(transport, never()).send(any());
        assertThat(jdbc.queryForObject("SELECT status FROM board_todo_push_deliveries WHERE delivery_id = ?", String.class, id)).isEqualTo("FAILED");
    }
    @Test void cannotStealAnotherDeviceEndpointAndRejectsSpoofedOwnerAndPrivateUrls() throws Exception {
        var own = session(2); device(own, "private-endpoint");
        var init = mvc.perform(get("/api/v1/board-todos/push").session(session(3))).andReturn();
        var cookie = MockCookie.parse(init.getResponse().getHeader("Set-Cookie"));
        for (String body : List.of("{\"expectedOwnerKey\":\"member:2\",\"endpoint\":\"https://fcm.googleapis.com/wp/private-endpoint\"}",
            "{\"expectedOwnerKey\":\"member:3\",\"endpoint\":\"https://fcm.googleapis.com/wp/private-endpoint\"}")) {
            mvc.perform(post("/api/v1/board-todos/push/subscription").session(session(3)).cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        }
        mvc.perform(post("/api/v1/board-todos/push/subscription").session(own).contentType(MediaType.APPLICATION_JSON)
            .content("{\"expectedOwnerKey\":\"member:2\",\"endpoint\":\"https://127.0.0.1/private\"}")).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_todo_push_subscriptions", Long.class)).isEqualTo(1);
    }
    @Test void migrationIsRepeatableWithoutLosingSchedulesOrSubscriptions() throws Exception {
        var row = create(); device(session(2), "migration");
        try (var connection = dataSource.getConnection()) {
            var migration = new FileSystemResource("../scripts/migrations/2026-11-16-todo-web-push.sql");
            ScriptUtils.executeSqlScript(connection, migration); ScriptUtils.executeSqlScript(connection, migration);
        }
        assertThat(todos.detail(TodoOwner.member(2L), row.todoId()).reminders()).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM board_todo_push_subscriptions", Long.class)).isEqualTo(1);
    }
}
