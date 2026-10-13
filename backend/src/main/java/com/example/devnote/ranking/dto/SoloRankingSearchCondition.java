package com.example.devnote.ranking.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

/**
 * 혼자 하는 게임 랭킹 조건(쿼리 문자열). 예) ?gameCode=MINESWEEPER&difficulty=BEGINNER&from=2026-10-01
 * difficulty는 지뢰 찾기·카드 짝 맞추기만 필요하다. 기간 규칙은 OnlineRankingSearchCondition과 같다.
 */
@Getter
@Setter
public class SoloRankingSearchCondition {
    @NotNull
    private SoloGameCode gameCode;

    private String difficulty;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate from;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate to;
}
