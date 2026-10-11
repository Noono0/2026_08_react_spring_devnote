package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BettingRoundTest {
    @Test
    void 모두_체크하면_한_바퀴로_끝난다() {
        int[] chips = {100, 100, 100};
        boolean[] in = {true, true, true};
        BettingRound round = new BettingRound(chips, in, 1, 10);
        assertThat(round.turnSeat()).isEqualTo(1);
        round.act(1, "CHECK", null);
        round.act(2, "CHECK", null);
        round.act(0, "CHECK", null);
        assertThat(round.isComplete()).isTrue();
        assertThat(round.collect()).isZero();
    }

    @Test
    void 올리면_다른_사람은_다시_결정하고_콜하면_끝난다() {
        int[] chips = {100, 100, 100};
        boolean[] in = {true, true, true};
        BettingRound round = new BettingRound(chips, in, 0, 10);
        round.act(0, "CHECK", null);
        round.act(1, "RAISE", 20);
        assertThatThrownBy(() -> round.act(2, "CHECK", null)).isInstanceOf(BusinessException.class);
        round.act(2, "CALL", null);
        assertThat(round.turnSeat()).isZero(); // 처음에 체크한 사람도 다시
        round.act(0, "FOLD", null);
        assertThat(round.isComplete()).isTrue();
        assertThat(round.collect()).isEqualTo(40);
        assertThat(chips).containsExactly(100, 80, 80);
        assertThat(in).containsExactly(false, true, true);
    }

    @Test
    void 가장_적은_칩까지만_올릴_수_있어_사이드_팟이_생기지_않는다() {
        int[] chips = {500, 30, 500};
        boolean[] in = {true, true, true};
        BettingRound round = new BettingRound(chips, in, 0, 10);
        assertThat(round.cap()).isEqualTo(30);
        assertThatThrownBy(() -> round.act(0, "RAISE", 40)).isInstanceOf(BusinessException.class);
        round.act(0, "RAISE", 30);
        round.act(1, "CALL", null);
        round.act(2, "CALL", null);
        assertThat(round.isComplete()).isTrue();
        assertThat(chips).containsExactly(470, 0, 470);
    }

    @Test
    void 혼자_남으면_바로_끝나고_차례가_아니면_할_수_없다() {
        int[] chips = {100, 100};
        boolean[] in = {true, true};
        BettingRound round = new BettingRound(chips, in, 0, 10);
        assertThatThrownBy(() -> round.act(1, "CHECK", null)).isInstanceOf(BusinessException.class);
        round.act(0, "FOLD", null);
        assertThat(round.isComplete()).isTrue();
    }
}
