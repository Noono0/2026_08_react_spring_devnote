package com.example.devnote.ranking.dao.parameter;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 랭킹 조회 조건(온라인·혼자 하는 게임 공통).
 *   gameCode      : 온라인은 OnlineGameType 이름, 혼자 하는 게임은 SoloGameCode 이름
 *   difficulty    : 혼자 하는 게임만(없으면 빈 문자열)
 *   rankingOrder  : 혼자 하는 게임만. SoloGameCode.RankingOrder 이름 → Mapper가 ORDER BY를 고른다
 *   fromInclusive·toExclusive : UTC 시각 범위. null이면 그쪽 끝은 제한하지 않는다
 */
@Getter
@Builder
public class GameRankingQueryParameter {
    private String gameCode;
    private String difficulty;
    private String rankingOrder;
    private LocalDateTime fromInclusive;
    private LocalDateTime toExclusive;
    private int limit;
}
