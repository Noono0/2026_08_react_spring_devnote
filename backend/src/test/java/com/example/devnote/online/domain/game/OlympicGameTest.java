package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.online.domain.game.OlympicGame.Phase;
import com.example.devnote.online.domain.game.OlympicGame.View;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OlympicGameTest {
    private static GameAction select(Integer... events) {
        return new GameAction("SELECT", null, null, List.of(events));
    }

    private static GameAction result(int mark) {
        return new GameAction("RESULT", null, mark, null);
    }

    private static final GameAction NEXT = new GameAction("NEXT", null, null, null);

    private static View view(OlympicGame game, Integer seat) {
        return (View) game.viewFor(seat);
    }

    @Test
    void 일번_선수만_종목을_고르고_고른_순서는_목록_순서() {
        OlympicGame game = new OlympicGame(List.of("철수", "영희"));
        assertThatThrownBy(() -> game.act(1, select(0))).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_NOT_YOUR_TURN));
        assertThatThrownBy(() -> game.act(0, select())).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, select(2, 2))).isInstanceOf(BusinessException.class);
        game.act(0, select(5, 0));
        View started = view(game, 0);
        assertThat(started.events()).containsExactly("SPRINT_100", "HIGH_JUMP");
        assertThat(started.phase()).isEqualTo(Phase.EVENT);
        assertThat(started.currentEvent()).isEqualTo("SPRINT_100");
    }

    @Test
    void 모두_기록을_내면_순위대로_메달_다음을_모두_누르면_다음_종목() {
        OlympicGame game = new OlympicGame(List.of("철수", "영희", "민수"));
        game.act(0, select(0, 2));
        assertThatThrownBy(() -> game.act(0, result(7_000))).isInstanceOf(BusinessException.class); // 100m 7초는 불가능
        game.act(0, new GameAction("PROGRESS", null, 4_500, null));
        assertThat(view(game, 1).players().get(0).progress()).isEqualTo(4_500);
        game.act(0, result(11_200));
        game.act(1, result(10_900));
        assertThat(view(game, null).phase()).isEqualTo(Phase.EVENT);
        assertThatThrownBy(() -> game.act(1, result(10_000))).isInstanceOf(BusinessException.class); // 두 번 낼 수 없음
        game.act(2, result(-1)); // 실격
        View afterSprint = view(game, null);
        assertThat(afterSprint.phase()).isEqualTo(Phase.RESULT);
        assertThat(afterSprint.results().get(0).medals()).containsExactly("SILVER", "GOLD", null);
        assertThat(afterSprint.results().get(0).marks()).containsExactly(11_200, 10_900, null);
        assertThat(afterSprint.players().get(1).gold()).isEqualTo(1);

        game.act(0, NEXT);
        game.act(1, NEXT);
        assertThat(view(game, null).phase()).isEqualTo(Phase.RESULT);
        game.act(2, NEXT);
        assertThat(view(game, null).currentEvent()).isEqualTo("LONG_JUMP");
        assertThat(view(game, null).players().get(0).progress()).isNull();

        game.act(0, result(700));
        game.act(1, result(700)); // 같은 기록은 같은 메달
        game.act(2, result(650));
        // 실제 올림픽처럼 공동 금이 둘이면 은은 없고 다음 선수는 동(3위)
        assertThat(view(game, null).results().get(1).medals()).containsExactly("GOLD", "GOLD", "BRONZE");
        game.act(0, NEXT);
        game.act(1, NEXT);
        game.act(2, NEXT);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(1); // 금 2개
        assertThat(game.resultText()).contains("우승 영희");
    }

    @Test
    void 혼자_하면_기준_기록으로_메달을_받고_우승자는_없다() {
        OlympicGame solo = new OlympicGame(List.of("철수"));
        solo.act(0, select(3));
        solo.act(0, result(8_100));
        assertThat(view(solo, 0).results().get(0).medals()).containsExactly("GOLD");
        solo.act(0, NEXT);
        assertThat(solo.isFinished()).isTrue();
        assertThat(solo.winnerSeats()).isEmpty();
    }

    @Test
    void 나간_선수는_기다리지_않고_고를_사람이_나가면_전_종목으로_시작() {
        OlympicGame game = new OlympicGame(List.of("철수", "영희"));
        game.leave(0);
        assertThat(view(game, 1).events()).hasSize(6);
        assertThat(view(game, 1).phase()).isEqualTo(Phase.EVENT);
        game.act(1, result(12_000));
        assertThat(view(game, 1).phase()).isEqualTo(Phase.RESULT);
        assertThatThrownBy(() -> game.act(0, NEXT)).isInstanceOf(BusinessException.class);
        game.leave(1);
        assertThat(game.isFinished()).isTrue();
    }
}
