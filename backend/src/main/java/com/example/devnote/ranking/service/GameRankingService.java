package com.example.devnote.ranking.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import com.example.devnote.online.domain.OnlineMatchResult;
import com.example.devnote.online.service.OnlineRoomService;
import com.example.devnote.ranking.dao.GameRankingDao;
import com.example.devnote.ranking.dao.parameter.GameRankingQueryParameter;
import com.example.devnote.ranking.dao.parameter.OnlineGameResultCreateParameter;
import com.example.devnote.ranking.dao.parameter.SoloGameRecordCreateParameter;
import com.example.devnote.ranking.dao.row.OnlineRankingRow;
import com.example.devnote.ranking.dao.row.SoloRankingRow;
import com.example.devnote.ranking.dto.OnlineRankingEntryResponse;
import com.example.devnote.ranking.dto.OnlineRankingSearchCondition;
import com.example.devnote.ranking.dto.SoloGameCode;
import com.example.devnote.ranking.dto.SoloGameRecordRequest;
import com.example.devnote.ranking.dto.SoloGameRecordResponse;
import com.example.devnote.ranking.dto.SoloRankingEntryResponse;
import com.example.devnote.ranking.dto.SoloRankingSearchCondition;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 게임 랭킹의 업무 규칙입니다.
 *
 * [기록이 들어오는 두 길]
 *   온라인 대전  : 서버가 승패를 판정하므로 OnlineRoomService가 게임이 끝날 때 recordOnlineMatch를 직접 부른다(API 없음).
 *   혼자 하는 게임: 브라우저가 점수를 계산하므로 POST로 받는다. 값을 꾸밀 수 있어 범위만 좁게 검사한다(완전히 막을 수는 없다).
 *
 * [누구의 기록인가]
 *   회원은 회원 번호로, 비회원은 닉네임으로 묶는다(같은 닉네임 = 같은 사람으로 보인다).
 *   비회원 기록은 1주일이 지나면 GameRankingCleanupService가 지운다.
 *
 * [기간] 화면은 한국 날짜(from~to)를 보내고, 여기서 UTC 시각 범위 [from 0시, to 다음 날 0시)로 바꿔 조회한다.
 * [순위] 앞 사람과 기록이 같으면 같은 순위다(1, 1, 3 …).
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class GameRankingService {
    static final int RANKING_SIZE = 50;
    static final int MINIMUM_ONLINE_PLAYERS = 2;
    /** 화면의 "이번 주·이번 달"과 날짜 선택은 한국 시간 기준이다 */
    static final ZoneId RANKING_ZONE = ZoneId.of("Asia/Seoul");

    private final GameRankingDao gameRankingDao;
    private final AuthenticationService authenticationService;
    private final Clock clock;

    @Autowired
    public GameRankingService(GameRankingDao gameRankingDao, AuthenticationService authenticationService) {
        this(gameRankingDao, authenticationService, Clock.systemUTC());
    }

    /** 테스트에서 시간을 고정할 때 쓰는 생성자 */
    GameRankingService(GameRankingDao gameRankingDao, AuthenticationService authenticationService, Clock clock) {
        this.gameRankingDao = gameRankingDao;
        this.authenticationService = authenticationService;
        this.clock = clock;
    }

    // ── 기록 ────────────────────────────────────────────────────────

    /**
     * 끝난 온라인 대전 한 판을 저장한다(플레이어마다 한 줄). 저장했으면 true.
     *   - 플레이어가 2명보다 적은 판(블랙잭 혼자 등)은 겨룬 것이 아니라 저장하지 않는다
     *   - 한 회원이 두 자리 이상 앉은 판(탭 두 개로 자기 자신과 대전)은 승수 쌓기를 막으려고 저장하지 않는다
     */
    @Transactional
    public boolean recordOnlineMatch(OnlineMatchResult match) {
        List<OnlineMatchResult.Player> players = match.players();
        if (players.size() < MINIMUM_ONLINE_PLAYERS) return false;
        List<Long> memberIds = players.stream().map(OnlineMatchResult.Player::memberId).filter(Objects::nonNull).toList();
        if (memberIds.stream().distinct().count() != memberIds.size()) {
            log.warn("같은 회원이 여러 자리에 앉은 판이라 랭킹에 저장하지 않습니다 gameType={}", match.gameType());
            return false;
        }
        LocalDateTime playedAt = LocalDateTime.ofInstant(Instant.ofEpochMilli(match.finishedAt()), ZoneOffset.UTC);
        for (OnlineMatchResult.Player player : players) {
            gameRankingDao.insertOnlineGameResult(OnlineGameResultCreateParameter.builder()
                .gameType(match.gameType().name())
                .memberId(player.memberId())
                .nickname(player.nickname())
                .playerCount(players.size())
                .won(player.won())
                .playedAt(playedAt)
                .build());
        }
        return true;
    }

    /** 혼자 하는 게임 기록 등록. 회원은 회원 이름으로, 비회원은 보낸 닉네임으로 기록한다 */
    @Transactional
    public SoloGameRecordResponse recordSoloGame(SoloGameRecordRequest request, HttpServletRequest servletRequest) {
        SoloGameCode gameCode = request.gameCode();
        String difficulty = requireDifficulty(gameCode, request.difficulty());
        Metrics metrics = requireMetrics(gameCode, request);
        MemberRow member = authenticationService.findAuthenticatedMember(servletRequest);
        String playerName = member == null ? requireGuestNickname(request.nickname()) : member.getMemberName();
        SoloGameRecordCreateParameter parameter = SoloGameRecordCreateParameter.builder()
            .gameCode(gameCode.name())
            .difficulty(difficulty)
            .memberId(member == null ? null : member.getMemberId())
            .nickname(playerName)
            .score(metrics.score())
            .elapsedSeconds(metrics.elapsedSeconds())
            .moves(metrics.moves())
            .playedAt(LocalDateTime.now(clock.withZone(ZoneOffset.UTC)))
            .build();
        gameRankingDao.insertSoloGameRecord(parameter);
        return new SoloGameRecordResponse(parameter.getSoloGameRecordId(), playerName, member != null);
    }

    // ── 조회 ────────────────────────────────────────────────────────

    public List<OnlineRankingEntryResponse> getOnlineRanking(OnlineRankingSearchCondition condition) {
        Period period = toPeriod(condition.getFrom(), condition.getTo());
        List<OnlineRankingRow> rows = gameRankingDao.selectOnlineRanking(GameRankingQueryParameter.builder()
            .gameCode(condition.getGameType().name())
            .fromInclusive(period.fromInclusive())
            .toExclusive(period.toExclusive())
            .limit(RANKING_SIZE)
            .build());
        List<OnlineRankingEntryResponse> entries = new ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            OnlineRankingRow row = rows.get(index);
            OnlineRankingRow previous = index == 0 ? null : rows.get(index - 1);
            boolean tied = previous != null && previous.getWins() == row.getWins() && previous.getPlays() == row.getPlays();
            int rank = tied ? entries.get(index - 1).rank() : index + 1;
            double winRate = row.getPlays() == 0 ? 0 : (double) row.getWins() / row.getPlays();
            entries.add(new OnlineRankingEntryResponse(rank, row.getPlayerName(), row.getMemberId() != null, row.getWins(), row.getPlays(), winRate));
        }
        return entries;
    }

    public List<SoloRankingEntryResponse> getSoloRanking(SoloRankingSearchCondition condition) {
        SoloGameCode gameCode = condition.getGameCode();
        String difficulty = requireDifficulty(gameCode, condition.getDifficulty());
        Period period = toPeriod(condition.getFrom(), condition.getTo());
        List<SoloRankingRow> rows = gameRankingDao.selectSoloRanking(GameRankingQueryParameter.builder()
            .gameCode(gameCode.name())
            .difficulty(difficulty)
            .rankingOrder(gameCode.getRankingOrder().name())
            .fromInclusive(period.fromInclusive())
            .toExclusive(period.toExclusive())
            .limit(RANKING_SIZE)
            .build());
        List<SoloRankingEntryResponse> entries = new ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            SoloRankingRow row = rows.get(index);
            SoloRankingRow previous = index == 0 ? null : rows.get(index - 1);
            boolean tied = previous != null
                && Objects.equals(previous.getScore(), row.getScore())
                && Objects.equals(previous.getElapsedSeconds(), row.getElapsedSeconds())
                && Objects.equals(previous.getMoves(), row.getMoves());
            int rank = tied ? entries.get(index - 1).rank() : index + 1;
            entries.add(new SoloRankingEntryResponse(rank, row.getPlayerName(), row.getMemberId() != null,
                row.getScore(), row.getElapsedSeconds(), row.getMoves(), row.getPlayedAt().toInstant(ZoneOffset.UTC)));
        }
        return entries;
    }

    // ── 검사 도우미 ──────────────────────────────────────────────────

    /** 난이도가 없는 게임은 빈 문자열로 맞추고, 있는 게임은 정해진 값만 받는다 */
    private static String requireDifficulty(SoloGameCode gameCode, String requestedDifficulty) {
        String difficulty = requestedDifficulty == null ? "" : requestedDifficulty.strip();
        if (!gameCode.allowsDifficulty(difficulty)) throw new BusinessException(ErrorCode.GAME_DIFFICULTY_INVALID);
        return difficulty;
    }

    /** 게임마다 필요한 값만 꺼낸다. 필요한 값이 비었으면 거절하고, 그 게임에서 쓰지 않는 값은 저장하지 않는다 */
    private static Metrics requireMetrics(SoloGameCode gameCode, SoloGameRecordRequest request) {
        return switch (gameCode.getRankingOrder()) {
            case SCORE_DESC -> new Metrics(requireValue(request.score()), null, null);
            case TIME_ASC -> new Metrics(null, requireValue(request.elapsedSeconds()), null);
            case MOVES_THEN_TIME_ASC -> new Metrics(null, requireValue(request.elapsedSeconds()), requireValue(request.moves()));
        };
    }

    private static Integer requireValue(Integer value) {
        if (value == null) throw new BusinessException(ErrorCode.GAME_RECORD_INVALID);
        return value;
    }

    /** 온라인 대전과 같은 닉네임 규칙: 앞뒤 공백을 빼고 2~12자, 줄바꿈 같은 제어 문자는 받지 않는다 */
    private static String requireGuestNickname(String requestedNickname) {
        String nickname = requestedNickname == null ? "" : requestedNickname.strip();
        boolean hasControl = nickname.chars().anyMatch(Character::isISOControl);
        if (hasControl || nickname.length() < OnlineRoomService.NICKNAME_MIN_LENGTH || nickname.length() > OnlineRoomService.NICKNAME_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.GAME_RANKING_NICKNAME_INVALID);
        }
        return nickname;
    }

    /** 한국 날짜 → UTC 시각 범위. to는 그날 끝까지 포함하도록 "다음 날 0시 미만"으로 바꾼다 */
    private static Period toPeriod(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) throw new BusinessException(ErrorCode.GAME_RANKING_PERIOD_INVALID);
        return new Period(from == null ? null : startOfDayInUtc(from), to == null ? null : startOfDayInUtc(to.plusDays(1)));
    }

    private static LocalDateTime startOfDayInUtc(LocalDate date) {
        return date.atStartOfDay(RANKING_ZONE).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    private record Metrics(Integer score, Integer elapsedSeconds, Integer moves) {}

    private record Period(LocalDateTime fromInclusive, LocalDateTime toExclusive) {}
}
