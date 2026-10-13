package com.example.devnote.online.dto;

import java.util.List;

/**
 * 뿌요뿌요 대전 상태(ROOM_STATE 안). 자기 판은 각자 브라우저가 계산하므로, 여기의 판(board)은 "남에게 보여 줄 요약"이다.
 *   seed       : 모두가 같은 순서의 쌍을 받도록 나눠 준 시드
 *   winnerSeat : 1위 자리(진행 중이면 null)
 */
public record PuyoBattleView(int seed, Integer winnerSeat, List<PuyoPlayerView> players) {
    /** board: 보이는 12줄 × 6칸 = 72글자. chains: 연쇄 합. rank: 등수(살아 있으면 0) */
    public record PuyoPlayerView(int seatIndex, String nickname, boolean alive, int score, int chains, String board, int rank) {}
}
