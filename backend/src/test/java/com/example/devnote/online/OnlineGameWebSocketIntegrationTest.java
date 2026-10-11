package com.example.devnote.online;

import com.example.devnote.DevNoteApplication;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 실제 서버를 띄우고 WebSocket 두 개(흑·백)로 방 만들기 → 입장 → 앉기 → 시작 → 오목 승리 → 채팅까지 확인한다.
 * (화면 없이 서버만으로 온라인 대전 전체 흐름이 맞는지 보는 테스트)
 */
@SpringBootTest(classes = DevNoteApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
class OnlineGameWebSocketIntegrationTest {
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

    @LocalServerPort
    private int port;
    @Autowired
    private TestRestTemplate restTemplate;
    @Autowired
    private ObjectMapper objectMapper;

    /** 받은 메시지를 줄 세워 두고, 원하는 메시지가 올 때까지 기다리는 테스트용 연결 */
    private final class Client extends TextWebSocketHandler {
        final BlockingQueue<JsonNode> received = new LinkedBlockingQueue<>();
        WebSocketSession session;

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
            received.add(objectMapper.readTree(message.getPayload()));
        }

        void send(Map<String, Object> message) throws Exception {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
        }

        JsonNode await(Predicate<JsonNode> condition) throws InterruptedException {
            while (true) {
                JsonNode message = received.poll(5, TimeUnit.SECONDS);
                assertThat(message).as("기다리던 메시지가 5초 안에 오지 않았습니다").isNotNull();
                if (condition.test(message)) return message;
            }
        }

        JsonNode awaitRoom(Predicate<JsonNode> condition) throws InterruptedException {
            return await(message -> message.path("type").asText().equals("ROOM_STATE") && condition.test(message.path("room")));
        }
    }

    private Client connect() throws Exception {
        Client client = new Client();
        client.session = new StandardWebSocketClient()
            .execute(client, new WebSocketHttpHeaders(), URI.create("ws://localhost:" + port + "/api/v1/online/ws"))
            .get(5, TimeUnit.SECONDS);
        return client;
    }

    @Test
    void 두_사람이_웹소켓으로_오목을_두고_관전자도_같은_결과와_채팅을_받는다() throws Exception {
        JsonNode created = restTemplate.postForObject("http://localhost:" + port + "/api/v1/online/rooms",
            Map.of("title", "통합 테스트 방", "gameType", "OMOK", "seatCount", 2, "password", "4321", "membersOnly", false), JsonNode.class);
        String roomId = created.path("data").path("roomId").asText();
        String hostToken = created.path("data").path("hostToken").asText();

        JsonNode rooms = restTemplate.getForObject("http://localhost:" + port + "/api/v1/online/rooms", JsonNode.class);
        assertThat(rooms.path("data").get(0).path("hasPassword").asBoolean()).isTrue();
        assertThat(rooms.path("data").toString()).doesNotContain("4321"); // 비밀번호는 목록에 나가지 않는다

        Client black = connect();
        Client white = connect();
        Client watcher = connect();
        black.send(Map.of("type", "JOIN", "roomId", roomId, "nickname", "흑돌", "hostToken", hostToken));
        black.awaitRoom(room -> room.path("participants").size() == 1);

        white.send(Map.of("type", "JOIN", "roomId", roomId, "nickname", "백돌", "password", "틀림"));
        JsonNode error = white.await(message -> message.path("type").asText().equals("ERROR"));
        assertThat(error.path("error").path("code").asText()).isEqualTo("ONLINE_ROOM_PASSWORD_INVALID");
        white.send(Map.of("type", "JOIN", "roomId", roomId, "nickname", "백돌", "password", "4321"));
        watcher.send(Map.of("type", "JOIN", "roomId", roomId, "nickname", "구경꾼", "password", "4321"));
        watcher.awaitRoom(room -> room.path("participants").size() == 3);

        black.send(Map.of("type", "SIT", "seatIndex", 0));
        white.send(Map.of("type", "SIT", "seatIndex", 1));
        black.awaitRoom(room -> !room.path("seats").path(1).isNull());
        black.send(Map.of("type", "START"));
        white.awaitRoom(room -> room.path("status").asText().equals("PLAYING"));

        for (int col = 0; col < 4; col++) {
            final int placedCol = col;
            black.send(Map.of("type", "OMOK_PLACE", "row", 7, "col", col));
            white.awaitRoom(room -> room.path("omok").path("board").path(7).path(placedCol).asInt() == 1);
            white.send(Map.of("type", "OMOK_PLACE", "row", 8, "col", col));
            black.awaitRoom(room -> room.path("omok").path("board").path(8).path(placedCol).asInt() == 2);
        }
        black.send(Map.of("type", "OMOK_PLACE", "row", 7, "col", 4));
        JsonNode finished = watcher.awaitRoom(room -> room.path("status").asText().equals("WAITING") && !room.path("lastResult").isNull());
        assertThat(finished.path("room").path("lastResult").asText()).isEqualTo("흑 흑돌 승리");
        assertThat(finished.path("room").path("omok").path("winLine").size()).isEqualTo(5);

        watcher.send(Map.of("type", "CHAT", "text", "잘 봤어요"));
        JsonNode chat = black.await(message -> message.path("type").asText().equals("CHAT")
            && message.path("chats").toString().contains("잘 봤어요"));
        assertThat(chat.path("chats").get(0).path("spectator").asBoolean()).isTrue();

        black.session.close();
        JsonNode afterLeave = white.awaitRoom(room -> room.path("participants").size() == 2);
        assertThat(afterLeave.path("room").path("hostId").asText()).isEqualTo(afterLeave.path("room").path("myParticipantId").asText());
        white.session.close();
        watcher.session.close();
    }

    @Test
    void 허락하지_않은_사이트에서_온_연결은_거절한다() {
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add(HttpHeaders.ORIGIN, "https://evil.example.com");
        Client client = new Client();
        boolean rejected;
        try {
            new StandardWebSocketClient().execute(client, headers, URI.create("ws://localhost:" + port + "/api/v1/online/ws")).get(5, TimeUnit.SECONDS);
            rejected = false;
        } catch (Exception exception) {
            rejected = true; // 서버가 403으로 handshake를 거절하면 연결 자체가 실패한다
        }
        assertThat(rejected).isTrue();
    }
}
