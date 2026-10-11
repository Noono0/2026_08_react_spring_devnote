package com.example.devnote.ranking.dto;

import java.time.Instant;

/** 혼자 하는 게임 랭킹 한 줄: 기간 안에서 그 사람의 가장 좋은 기록 하나. 그 게임에서 쓰지 않는 값은 null */
public record SoloRankingEntryResponse(
    int rank,
    String playerName,
    boolean member,
    Integer score,
    Integer elapsedSeconds,
    Integer moves,
    Instant playedAt
) {
}
