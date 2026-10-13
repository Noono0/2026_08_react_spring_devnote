package com.example.devnote.online.domain.game;

import org.junit.jupiter.api.Test;

import java.util.function.IntUnaryOperator;

import static org.assertj.core.api.Assertions.assertThat;

class RaceStandingsTest {
    // 자리 0~3의 기록: 성공 비용(적을수록 좋음)과 실패 점수(클수록 좋음)
    private static final int[] COSTS = {30, 20, 20, 99};
    private static final int[] SCORES = {100, 500, 300, 900};
    private static final IntUnaryOperator COST = seat -> COSTS[seat];
    private static final IntUnaryOperator SCORE = seat -> SCORES[seat];

    @Test
    void 성공은_비용이_적은_순_같으면_먼저_끝낸_순이고_실패는_점수_순_빠진_사람은_맨_아래다() {
        RaceStandings standings = new RaceStandings(4);
        standings.succeed(2); // 비용 20, 1번째로 끝냄
        standings.fail(0); // 점수 100
        standings.succeed(1); // 비용 20, 3번째로 끝냄
        standings.leave(3); // 점수 900이어도 빠졌으므로 맨 아래

        assertThat(standings.isFinished()).isTrue();
        assertThat(standings.ranks(COST, SCORE)).containsExactly(3, 2, 1, 4);
        assertThat(standings.winners(COST, SCORE)).containsExactly(2);
        assertThat(standings.finishOrderOf(1)).isEqualTo(3);
        assertThat(standings.finishOrderOf(3)).isNull();
    }

    @Test
    void 끝나기_전에는_승자가_없고_다른_사람이_끝냈으면_한_명이_남아도_계속한다() {
        RaceStandings standings = new RaceStandings(3);
        standings.fail(0);
        standings.leave(1);
        assertThat(standings.isFinished()).isFalse();
        assertThat(standings.winners(COST, SCORE)).isEmpty();
        assertThat(standings.leave(0)).isFalse(); // 이미 실패한 자리는 결과 그대로
    }

    @Test
    void 나머지가_모두_빠지면_남은_사람이_바로_이긴다() {
        RaceStandings threeSeats = new RaceStandings(3);
        threeSeats.leave(0);
        assertThat(threeSeats.isFinished()).isFalse();
        threeSeats.leave(1);
        assertThat(threeSeats.isFinished()).isTrue();
        assertThat(threeSeats.winners(COST, SCORE)).containsExactly(2);

        RaceStandings twoSeats = new RaceStandings(2);
        twoSeats.leave(0);
        assertThat(twoSeats.isFinished()).isTrue();
        assertThat(twoSeats.winners(COST, SCORE)).containsExactly(1);
    }

    @Test
    void 실패끼리_같은_점수면_공동_승리() {
        RaceStandings standings = new RaceStandings(2);
        IntUnaryOperator sameScore = seat -> 50;
        standings.fail(1);
        standings.fail(0);
        assertThat(standings.winners(COST, sameScore)).containsExactly(0, 1);
    }
}
