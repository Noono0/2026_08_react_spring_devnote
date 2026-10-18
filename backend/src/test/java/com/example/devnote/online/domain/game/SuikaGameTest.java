package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SuikaGameTest {
    private static final List<String> TWO = List.of("철수", "영희");

    private static GameAction score(int value) {
        return new GameAction("SCORE", null, value, null);
    }

    private static GameAction over(int value) {
        return new GameAction("OVER", null, value, null);
    }

    private static SuikaGame.View view(SuikaGame game) {
        return (SuikaGame.View) game.viewFor(0);
    }

    @Test
    void 모두_같은_시드를_받고_점수는_늘기만_한다() {
        SuikaGame game = new SuikaGame(TWO, new Random(3));
        assertThat(((SuikaGame.View) game.viewFor(1)).seed()).isEqualTo(view(game).seed());
        game.act(0, score(30));
        assertThat(view(game).scores()).containsExactly(30, 0);
        assertThatThrownBy(() -> game.act(0, score(10))).isInstanceOf(BusinessException.class); // 줄어들 수 없다
        assertThatThrownBy(() -> game.act(0, score(30 + SuikaGame.MAX_SCORE_STEP + 1))).isInstanceOf(BusinessException.class); // 너무 크게
        assertThatThrownBy(() -> game.act(0, new GameAction("SCORE", null, null, null))).isInstanceOf(BusinessException.class);
    }

    @Test
    void 모두_상자가_넘치면_바로_끝나고_높은_점수가_이긴다() {
        SuikaGame game = new SuikaGame(TWO, new Random(3));
        game.act(0, over(120));
        assertThat(game.isFinished()).isFalse();
        assertThat(game.hasSettledResult(0)).isTrue();
        assertThatThrownBy(() -> game.act(0, score(130))).isInstanceOf(BusinessException.class); // 넘친 상자는 끝
        game.act(1, over(90));
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(0);
        assertThat(game.resultText()).isEqualTo("수박게임 철수 승리 (120점)");
    }

    @Test
    void 삼분이_지나면_끝난다() {
        SuikaGame game = new SuikaGame(TWO, new Random(3));
        assertThat(game.tick(0)).isTrue();
        assertThat(view(game).deadline()).isEqualTo(SuikaGame.TIME_LIMIT_MILLIS);
        game.act(1, score(10));
        assertThat(game.tick(SuikaGame.TIME_LIMIT_MILLIS - 1)).isFalse();
        assertThat(game.tick(SuikaGame.TIME_LIMIT_MILLIS)).isTrue();
        assertThat(game.winnerSeats()).containsExactly(1);
    }

    @Test
    void 한_명만_남으면_끝나고_모두_0점이면_무승부다() {
        SuikaGame game = new SuikaGame(List.of("가", "나", "다"), new Random(1));
        game.leave(0);
        assertThat(game.isFinished()).isFalse();
        game.leave(1);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).isEmpty();
    }
}
