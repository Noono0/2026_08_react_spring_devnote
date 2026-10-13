package com.example.devnote.ranking.dto;

/**
 * 온라인 대전 랭킹 한 줄.
 *   member  : false면 비회원(같은 닉네임은 같은 사람으로 묶인다)
 *   winRate : 0.0 ~ 1.0 (화면이 %로 바꾼다)
 */
public record OnlineRankingEntryResponse(int rank, String playerName, boolean member, int wins, int plays, double winRate) {
}
