package com.example.devnote.ranking.dao;

import com.example.devnote.DevNoteApplication;
import com.example.devnote.ranking.dao.parameter.GameRankingQueryParameter;
import com.example.devnote.ranking.dao.parameter.OnlineGameResultCreateParameter;
import com.example.devnote.ranking.dao.parameter.SoloGameRecordCreateParameter;
import com.example.devnote.ranking.dao.row.OnlineRankingRow;
import com.example.devnote.ranking.dao.row.SoloRankingRow;
import com.example.devnote.ranking.service.GameRankingCleanupService;
import org.junit.jupiter.api.BeforeEach;
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

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 랭킹 SQL(사람 묶기·사람마다 최고 기록·기간·비회원 정리)을 실제 MySQL로 확인합니다.
 * 회원 1·2번은 data.sql이 넣는 기본 회원입니다.
 */
@SpringBootTest(classes = DevNoteApplication.class)
@ActiveProfiles("test")
@Testcontainers
class GameRankingMapperIntegrationTest {
    private static final LocalDateTime IN_OCTOBER = LocalDateTime.of(2026, 10, 5, 3, 0);

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
    }

    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private GameRankingDao gameRankingDao;
    @Autowired private GameRankingCleanupService cleanupService;

    @BeforeEach
    void clearRecords() {
        jdbcTemplate.update("DELETE FROM online_game_results");
        jdbcTemplate.update("DELETE FROM solo_game_records");
    }

    @Test
    void 온라인_랭킹은_회원은_번호로_비회원은_닉네임으로_묶고_기간과_종목으로_거른다() {
        insertOnline("OMOK", 1L, "예전이름", true, IN_OCTOBER);
        insertOnline("OMOK", 1L, "새이름", true, IN_OCTOBER); // 같은 회원 → 이름이 달라도 한 줄
        insertOnline("OMOK", null, "철수", true, IN_OCTOBER);
        insertOnline("OMOK", null, "철수", false, IN_OCTOBER);
        insertOnline("OMOK", null, "영희", false, IN_OCTOBER);
        insertOnline("OMOK", 2L, "기간밖", true, LocalDateTime.of(2026, 9, 1, 0, 0));
        insertOnline("CHESS", 2L, "다른종목", true, IN_OCTOBER);

        List<OnlineRankingRow> rows = gameRankingDao.selectOnlineRanking(GameRankingQueryParameter.builder()
            .gameCode("OMOK")
            .fromInclusive(LocalDateTime.of(2026, 10, 1, 0, 0))
            .toExclusive(LocalDateTime.of(2026, 11, 1, 0, 0))
            .limit(50)
            .build());

        assertThat(rows).extracting(OnlineRankingRow::getPlayerName).containsExactly(memberName(1L), "철수", "영희");
        assertThat(rows).extracting(OnlineRankingRow::getWins).containsExactly(2, 1, 0);
        assertThat(rows).extracting(OnlineRankingRow::getPlays).containsExactly(2, 2, 1);
        assertThat(rows).extracting(OnlineRankingRow::getMemberId).containsExactly(1L, null, null);
    }

    @Test
    void 혼자_하는_게임_랭킹은_사람마다_가장_좋은_기록_하나만_게임의_기준으로_줄_세운다() {
        insertSolo("TETRIS", "", 1L, 500, null, null);
        insertSolo("TETRIS", "", 1L, 900, null, null);
        insertSolo("TETRIS", "", null, 700, null, null);
        insertSolo("GAME_2048", "", null, 9999, null, null);

        List<SoloRankingRow> tetris = gameRankingDao.selectSoloRanking(soloQuery("TETRIS", "", "SCORE_DESC"));
        assertThat(tetris).extracting(SoloRankingRow::getScore).containsExactly(900, 700);
        assertThat(tetris).extracting(SoloRankingRow::getPlayerName).containsExactly(memberName(1L), "손님");

        insertSolo("MEMORY", "HARD", 2L, null, 50, 12);
        insertSolo("MEMORY", "HARD", 2L, null, 90, 10); // 시도가 더 적으니 이쪽이 회원 2의 최고 기록
        insertSolo("MEMORY", "HARD", null, null, 60, 10);
        insertSolo("MEMORY", "NORMAL", null, null, 10, 5);

        List<SoloRankingRow> memory = gameRankingDao.selectSoloRanking(soloQuery("MEMORY", "HARD", "MOVES_THEN_TIME_ASC"));
        assertThat(memory).extracting(SoloRankingRow::getMoves).containsExactly(10, 10);
        assertThat(memory).extracting(SoloRankingRow::getElapsedSeconds).containsExactly(60, 90); // 시도가 같으면 시간이 짧은 쪽이 앞
    }

    @Test
    void 정리는_1주일_지난_비회원_기록만_지운다() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        insertOnline("OMOK", null, "오래된손님", false, now.minusDays(8));
        insertOnline("OMOK", null, "최근손님", false, now.minusDays(1));
        insertOnline("OMOK", 1L, "회원", true, now.minusDays(30));
        insertSolo("TETRIS", "", null, 100, null, null, now.minusDays(8));
        insertSolo("TETRIS", "", 1L, 100, null, null, now.minusDays(30));

        assertThat(cleanupService.deleteExpiredGuestRecords()).isEqualTo(2);
        assertThat(jdbcTemplate.queryForList("SELECT nickname FROM online_game_results ORDER BY nickname", String.class))
            .containsExactlyInAnyOrder("최근손님", "회원");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM solo_game_records WHERE member_id IS NULL", Integer.class)).isZero();
    }

    private void insertOnline(String gameType, Long memberId, String nickname, boolean won, LocalDateTime playedAt) {
        gameRankingDao.insertOnlineGameResult(OnlineGameResultCreateParameter.builder()
            .gameType(gameType).memberId(memberId).nickname(nickname).playerCount(2).won(won).playedAt(playedAt).build());
    }

    private void insertSolo(String gameCode, String difficulty, Long memberId, Integer score, Integer seconds, Integer moves) {
        insertSolo(gameCode, difficulty, memberId, score, seconds, moves, IN_OCTOBER);
    }

    private void insertSolo(String gameCode, String difficulty, Long memberId, Integer score, Integer seconds, Integer moves, LocalDateTime playedAt) {
        SoloGameRecordCreateParameter parameter = SoloGameRecordCreateParameter.builder()
            .gameCode(gameCode).difficulty(difficulty).memberId(memberId).nickname(memberId == null ? "손님" : "회원")
            .score(score).elapsedSeconds(seconds).moves(moves).playedAt(playedAt).build();
        gameRankingDao.insertSoloGameRecord(parameter);
        assertThat(parameter.getSoloGameRecordId()).isNotNull(); // useGeneratedKeys로 채워진다
    }

    private static GameRankingQueryParameter soloQuery(String gameCode, String difficulty, String rankingOrder) {
        return GameRankingQueryParameter.builder().gameCode(gameCode).difficulty(difficulty).rankingOrder(rankingOrder).limit(50).build();
    }

    private String memberName(long memberId) {
        return jdbcTemplate.queryForObject("SELECT member_name FROM members WHERE member_id = ?", String.class, memberId);
    }
}
