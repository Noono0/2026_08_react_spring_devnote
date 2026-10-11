package com.example.devnote.ranking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * 혼자 하는 게임 기록 등록 요청. 점수·시간은 브라우저가 계산한 값이라 믿을 수 없으므로 범위를 좁게 검사한다.
 * 게임마다 필요한 값이 다르다(GameRankingService.requireMetrics): 2048·테트리스는 score, 지뢰 찾기는 elapsedSeconds,
 * 카드 짝 맞추기는 moves + elapsedSeconds.
 *
 *   difficulty : 지뢰 찾기·카드 짝 맞추기만. 다른 게임은 비운다
 *   nickname   : 비회원만 쓴다(2~12자). 회원은 회원 이름으로 기록하고 이 값은 무시한다
 */
public record SoloGameRecordRequest(
    @NotNull SoloGameCode gameCode,
    String difficulty,
    String nickname,
    @PositiveOrZero @Max(100_000_000) Integer score,
    @PositiveOrZero @Max(86_400) Integer elapsedSeconds,
    @Positive @Max(10_000) Integer moves
) {
}
