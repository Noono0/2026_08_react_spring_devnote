package com.example.devnote.ranking.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import com.example.devnote.online.domain.OnlineGameType;
import com.example.devnote.online.domain.OnlineMatchResult;
import com.example.devnote.ranking.dao.GameRankingDao;
import com.example.devnote.ranking.dao.parameter.GameRankingQueryParameter;
import com.example.devnote.ranking.dao.parameter.OnlineGameResultCreateParameter;
import com.example.devnote.ranking.dao.parameter.SoloGameRecordCreateParameter;
import com.example.devnote.ranking.dao.row.OnlineRankingRow;
import com.example.devnote.ranking.dao.row.SoloRankingRow;
import com.example.devnote.ranking.dto.OnlineRankingSearchCondition;
import com.example.devnote.ranking.dto.SoloGameCode;
import com.example.devnote.ranking.dto.SoloGameRecordRequest;
import com.example.devnote.ranking.dto.SoloGameRecordResponse;
import com.example.devnote.ranking.dto.SoloRankingSearchCondition;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GameRankingServiceTest {
    private static final Instant NOW = Instant.parse("2026-10-11T12:00:00Z");

    private final GameRankingDao gameRankingDao = mock(GameRankingDao.class);
    private final AuthenticationService authenticationService = mock(AuthenticationService.class);
    private final GameRankingService service = new GameRankingService(gameRankingDao, authenticationService, Clock.fixed(NOW, ZoneOffset.UTC));

    private static void assertError(Runnable action, ErrorCode errorCode) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(errorCode));
    }

    private static OnlineMatchResult match(OnlineMatchResult.Player... players) {
        return new OnlineMatchResult(OnlineGameType.OMOK, List.of(players), NOW.toEpochMilli());
    }

    private void loginAs(long memberId, String memberName) {
        MemberRow member = new MemberRow();
        member.setMemberId(memberId);
        member.setMemberName(memberName);
        when(authenticationService.findAuthenticatedMember(any())).thenReturn(member);
    }

    // ── 온라인 대전 기록 ─────────────────────────────────────────────

    @Test
    void 온라인_대전은_플레이어마다_한_줄씩_UTC_시각으로_저장한다() {
        boolean recorded = service.recordOnlineMatch(match(
            new OnlineMatchResult.Player(7L, "회원", true),
            new OnlineMatchResult.Player(null, "손님", false)));

        assertThat(recorded).isTrue();
        ArgumentCaptor<OnlineGameResultCreateParameter> captor = ArgumentCaptor.forClass(OnlineGameResultCreateParameter.class);
        verify(gameRankingDao, times(2)).insertOnlineGameResult(captor.capture());
        assertThat(captor.getAllValues()).extracting("memberId", "nickname", "won", "playerCount", "gameType")
            .containsExactly(tuple(7L, "회원", true, 2, "OMOK"), tuple(null, "손님", false, 2, "OMOK"));
        assertThat(captor.getValue().getPlayedAt()).isEqualTo(LocalDateTime.of(2026, 10, 11, 12, 0));
    }

    @Test
    void 혼자_한_판과_한_회원이_두_자리에_앉은_판은_저장하지_않는다() {
        assertThat(service.recordOnlineMatch(match(new OnlineMatchResult.Player(7L, "회원", true)))).isFalse();
        assertThat(service.recordOnlineMatch(match(
            new OnlineMatchResult.Player(7L, "회원", true),
            new OnlineMatchResult.Player(7L, "회원", false)))).isFalse();
        verify(gameRankingDao, never()).insertOnlineGameResult(any());
    }

    // ── 혼자 하는 게임 기록 ───────────────────────────────────────────

    @Test
    void 비회원은_닉네임으로_기록하고_그_게임에서_쓰지_않는_값은_버린다() {
        SoloGameRecordResponse response = service.recordSoloGame(
            new SoloGameRecordRequest(SoloGameCode.MINESWEEPER, "BEGINNER", "  철수  ", 999, 42, 7), new MockHttpServletRequest());

        ArgumentCaptor<SoloGameRecordCreateParameter> captor = ArgumentCaptor.forClass(SoloGameRecordCreateParameter.class);
        verify(gameRankingDao).insertSoloGameRecord(captor.capture());
        SoloGameRecordCreateParameter saved = captor.getValue();
        assertThat(saved.getNickname()).isEqualTo("철수");
        assertThat(saved.getMemberId()).isNull();
        assertThat(saved.getElapsedSeconds()).isEqualTo(42);
        assertThat(saved.getScore()).isNull(); // 지뢰 찾기는 시간만 쓴다
        assertThat(saved.getMoves()).isNull();
        assertThat(saved.getPlayedAt()).isEqualTo(LocalDateTime.of(2026, 10, 11, 12, 0));
        assertThat(response.playerName()).isEqualTo("철수");
        assertThat(response.member()).isFalse();
    }

    @Test
    void 회원은_보낸_닉네임_대신_회원_이름으로_기록한다() {
        loginAs(3L, "김회원");
        SoloGameRecordResponse response = service.recordSoloGame(
            new SoloGameRecordRequest(SoloGameCode.GAME_2048, null, "다른이름", 2048, null, null), new MockHttpServletRequest());

        ArgumentCaptor<SoloGameRecordCreateParameter> captor = ArgumentCaptor.forClass(SoloGameRecordCreateParameter.class);
        verify(gameRankingDao).insertSoloGameRecord(captor.capture());
        assertThat(captor.getValue().getMemberId()).isEqualTo(3L);
        assertThat(captor.getValue().getNickname()).isEqualTo("김회원");
        assertThat(captor.getValue().getDifficulty()).isEmpty();
        assertThat(response.member()).isTrue();
    }

    @Test
    void 스도쿠는_난이도마다_다_푼_시간으로_기록한다() {
        service.recordSoloGame(new SoloGameRecordRequest(SoloGameCode.SUDOKU, "HARD", "철수", 500, 312, 9), new MockHttpServletRequest());

        ArgumentCaptor<SoloGameRecordCreateParameter> captor = ArgumentCaptor.forClass(SoloGameRecordCreateParameter.class);
        verify(gameRankingDao).insertSoloGameRecord(captor.capture());
        assertThat(captor.getValue().getGameCode()).isEqualTo("SUDOKU");
        assertThat(captor.getValue().getDifficulty()).isEqualTo("HARD");
        assertThat(captor.getValue().getElapsedSeconds()).isEqualTo(312);
        assertThat(captor.getValue().getScore()).isNull();
        assertThat(captor.getValue().getMoves()).isNull();
        assertThat(SoloGameCode.SUDOKU.getRankingOrder()).isEqualTo(SoloGameCode.RankingOrder.TIME_ASC);
    }

    @Test
    void 난이도_필요한_값_비회원_닉네임이_규칙에_맞지_않으면_거절한다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        assertError(() -> service.recordSoloGame(new SoloGameRecordRequest(SoloGameCode.MINESWEEPER, "EASY", "철수", null, 10, null), request),
            ErrorCode.GAME_DIFFICULTY_INVALID); // 지뢰 찾기에는 EASY가 없다
        assertError(() -> service.recordSoloGame(new SoloGameRecordRequest(SoloGameCode.TETRIS, "HARD", "철수", 100, null, null), request),
            ErrorCode.GAME_DIFFICULTY_INVALID); // 테트리스는 난이도가 없다
        assertError(() -> service.recordSoloGame(new SoloGameRecordRequest(SoloGameCode.SUDOKU, "EXPERT", "철수", null, 10, null), request),
            ErrorCode.GAME_DIFFICULTY_INVALID); // 스도쿠는 EASY·NORMAL·HARD만
        assertError(() -> service.recordSoloGame(new SoloGameRecordRequest(SoloGameCode.SUDOKU, "EASY", "철수", null, null, null), request),
            ErrorCode.GAME_RECORD_INVALID); // 스도쿠는 시간이 필요
        assertError(() -> service.recordSoloGame(new SoloGameRecordRequest(SoloGameCode.MEMORY, "NORMAL", "철수", null, 30, null), request),
            ErrorCode.GAME_RECORD_INVALID); // 카드 짝 맞추기는 시도 횟수도 필요
        assertError(() -> service.recordSoloGame(new SoloGameRecordRequest(SoloGameCode.APPLE, null, "철수", 171, null, null), request),
            ErrorCode.GAME_RECORD_INVALID); // 사과게임은 사과가 170개라 171점은 나올 수 없다
        assertError(() -> service.recordSoloGame(new SoloGameRecordRequest(SoloGameCode.TETRIS, null, "철", 100, null, null), request),
            ErrorCode.GAME_RANKING_NICKNAME_INVALID);
        assertError(() -> service.recordSoloGame(new SoloGameRecordRequest(SoloGameCode.TETRIS, null, "철수\n영희", 100, null, null), request),
            ErrorCode.GAME_RANKING_NICKNAME_INVALID);
        verify(gameRankingDao, never()).insertSoloGameRecord(any());
    }

    // ── 조회 ────────────────────────────────────────────────────────

    @Test
    void 한국_날짜_기간을_UTC_범위로_바꾸고_기록이_같으면_같은_순위다() {
        when(gameRankingDao.selectOnlineRanking(any())).thenReturn(List.of(
            onlineRow(1L, "가", 3, 4), onlineRow(null, "나", 3, 4), onlineRow(2L, "다", 1, 1)));
        OnlineRankingSearchCondition condition = new OnlineRankingSearchCondition();
        condition.setGameType(OnlineGameType.CHESS);
        condition.setFrom(LocalDate.of(2026, 10, 1));
        condition.setTo(LocalDate.of(2026, 10, 31));

        var entries = service.getOnlineRanking(condition);

        ArgumentCaptor<GameRankingQueryParameter> captor = ArgumentCaptor.forClass(GameRankingQueryParameter.class);
        verify(gameRankingDao).selectOnlineRanking(captor.capture());
        assertThat(captor.getValue().getGameCode()).isEqualTo("CHESS");
        assertThat(captor.getValue().getFromInclusive()).isEqualTo(LocalDateTime.of(2026, 9, 30, 15, 0)); // 10/1 0시(한국) = 9/30 15시(UTC)
        assertThat(captor.getValue().getToExclusive()).isEqualTo(LocalDateTime.of(2026, 10, 31, 15, 0)); // 10/31 하루 끝까지
        assertThat(entries).extracting("rank").containsExactly(1, 1, 3);
        assertThat(entries).extracting("member").containsExactly(true, false, true);
        assertThat(entries.get(0).winRate()).isEqualTo(0.75);
    }

    @Test
    void 기간을_비우면_전체이고_시작일이_종료일보다_늦으면_거절한다() {
        OnlineRankingSearchCondition allTime = new OnlineRankingSearchCondition();
        allTime.setGameType(OnlineGameType.OMOK);
        service.getOnlineRanking(allTime);
        ArgumentCaptor<GameRankingQueryParameter> captor = ArgumentCaptor.forClass(GameRankingQueryParameter.class);
        verify(gameRankingDao).selectOnlineRanking(captor.capture());
        assertThat(captor.getValue().getFromInclusive()).isNull();
        assertThat(captor.getValue().getToExclusive()).isNull();

        OnlineRankingSearchCondition reversed = new OnlineRankingSearchCondition();
        reversed.setGameType(OnlineGameType.OMOK);
        reversed.setFrom(LocalDate.of(2026, 10, 2));
        reversed.setTo(LocalDate.of(2026, 10, 1));
        assertError(() -> service.getOnlineRanking(reversed), ErrorCode.GAME_RANKING_PERIOD_INVALID);
    }

    @Test
    void 혼자_하는_게임_랭킹은_게임의_순서_기준과_난이도로_조회한다() {
        when(gameRankingDao.selectSoloRanking(any())).thenReturn(List.of(
            soloRow("가", 10, 20), soloRow("나", 10, 20), soloRow("다", 11, 15)));
        SoloRankingSearchCondition condition = new SoloRankingSearchCondition();
        condition.setGameCode(SoloGameCode.MEMORY);
        condition.setDifficulty("HARD");

        var entries = service.getSoloRanking(condition);

        ArgumentCaptor<GameRankingQueryParameter> captor = ArgumentCaptor.forClass(GameRankingQueryParameter.class);
        verify(gameRankingDao).selectSoloRanking(captor.capture());
        assertThat(captor.getValue().getRankingOrder()).isEqualTo("MOVES_THEN_TIME_ASC");
        assertThat(captor.getValue().getDifficulty()).isEqualTo("HARD");
        assertThat(entries).extracting("rank").containsExactly(1, 1, 3);
        assertThat(entries.get(0).playedAt()).isEqualTo(Instant.parse("2026-10-11T03:00:00Z"));

        SoloRankingSearchCondition missingDifficulty = new SoloRankingSearchCondition();
        missingDifficulty.setGameCode(SoloGameCode.MEMORY);
        assertError(() -> service.getSoloRanking(missingDifficulty), ErrorCode.GAME_DIFFICULTY_INVALID);
    }

    // ── 비회원 기록 정리 ──────────────────────────────────────────────

    @Test
    void 비회원_기록은_지금부터_7일_전보다_오래된_것만_지운다() {
        when(gameRankingDao.deleteGuestOnlineResultsBefore(any())).thenReturn(2);
        when(gameRankingDao.deleteGuestSoloRecordsBefore(any())).thenReturn(3);
        GameRankingCleanupService cleanupService = new GameRankingCleanupService(gameRankingDao, Clock.fixed(NOW, ZoneOffset.UTC));

        assertThat(cleanupService.deleteExpiredGuestRecords()).isEqualTo(5);
        verify(gameRankingDao).deleteGuestOnlineResultsBefore(LocalDateTime.of(2026, 10, 4, 12, 0));
        verify(gameRankingDao).deleteGuestSoloRecordsBefore(LocalDateTime.of(2026, 10, 4, 12, 0));
    }

    private static OnlineRankingRow onlineRow(Long memberId, String name, int wins, int plays) {
        OnlineRankingRow row = new OnlineRankingRow();
        row.setMemberId(memberId);
        row.setPlayerName(name);
        row.setWins(wins);
        row.setPlays(plays);
        return row;
    }

    private static SoloRankingRow soloRow(String name, int moves, int seconds) {
        SoloRankingRow row = new SoloRankingRow();
        row.setPlayerName(name);
        row.setMoves(moves);
        row.setElapsedSeconds(seconds);
        row.setPlayedAt(LocalDateTime.of(2026, 10, 11, 3, 0));
        return row;
    }
}
