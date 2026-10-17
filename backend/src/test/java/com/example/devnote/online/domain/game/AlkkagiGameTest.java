package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AlkkagiGameTest {
    private static final List<String> TWO = List.of("철수", "영희");

    private static GameAction flick(int stone, int angle, int power) {
        return new GameAction("FLICK", null, null, List.of(stone, angle, power));
    }

    private static AlkkagiGame.View view(AlkkagiGame game) {
        return (AlkkagiGame.View) game.viewFor(0);
    }

    /** [side, x, y] */
    private static AlkkagiGame board(int[]... stones) {
        return new AlkkagiGame(TWO, List.of(stones));
    }

    @Test
    void 흑은_아래_백은_위에_같은_간격으로_놓인다() {
        AlkkagiGame game = new AlkkagiGame(TWO, 6);
        AlkkagiGame.View view = view(game);
        assertThat(view.stones()).hasSize(12);
        assertThat(view.stones().subList(0, 6)).allMatch(stone -> stone.side() == 0 && stone.y() == 800);
        assertThat(view.stones().subList(6, 12)).allMatch(stone -> stone.side() == 1 && stone.y() == 200);
        assertThat(view.remaining()).containsExactly(6, 6);
        assertThat(game.drainAnnouncements()).singleElement().asString().contains("알 6개");
    }

    @Test
    void 정면으로_세게_맞히면_상대_알이_판_밖으로_떨어지고_마지막_알이면_이긴다() {
        AlkkagiGame game = board(new int[]{0, 500, 600}, new int[]{1, 500, 400});
        game.act(0, flick(0, 90, 100)); // 위쪽으로
        AlkkagiGame.View view = view(game);
        assertThat(view.stones().get(1).alive()).isFalse();
        assertThat(view.stones().get(0).alive()).isTrue(); // 같은 무게 정면 충돌: 쏜 알은 거의 멈춘다
        assertThat(view.lastShot().knockedOpponent()).isEqualTo(1);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(0);
    }

    @Test
    void 아무것도_못_맞히면_차례가_넘어가고_궤적의_처음과_끝이_위치와_같다() {
        AlkkagiGame game = board(new int[]{0, 500, 600}, new int[]{1, 500, 200});
        game.act(0, flick(0, 0, 30)); // 오른쪽으로 약하게
        AlkkagiGame.View view = view(game);
        assertThat(view.turnSeat()).isEqualTo(1);
        List<List<Integer>> frames = view.lastShot().frames();
        assertThat(frames.get(0)).containsExactly(500, 600, 500, 200);
        AlkkagiGame.Stone moved = view.stones().get(0);
        assertThat(frames.get(frames.size() - 1)).containsExactly(moved.x(), moved.y(), 500, 200);
        assertThat(moved.x()).isBetween(650, 750); // 속력 600, 감속 900 → 약 200 이동
        assertThat(moved.y()).isEqualTo(600);
    }

    @Test
    void 상대_알만_떨어뜨리면_한_번_더_튕긴다() {
        AlkkagiGame game = board(new int[]{0, 500, 600}, new int[]{1, 500, 400}, new int[]{1, 100, 100});
        game.act(0, flick(0, 90, 100));
        assertThat(view(game).remaining()).containsExactly(1, 1);
        assertThat(view(game).turnSeat()).isZero();
        assertThat(game.isFinished()).isFalse();
    }

    @Test
    void 내_알이_떨어져_모두_없어지면_진다() {
        AlkkagiGame game = board(new int[]{0, 960, 500}, new int[]{1, 100, 100});
        game.act(0, flick(0, 0, 60));
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(1);
    }

    @Test
    void 같은_판에서_같은_각도와_힘이면_결과가_같다() {
        AlkkagiGame first = new AlkkagiGame(TWO, 4);
        AlkkagiGame second = new AlkkagiGame(TWO, 4);
        first.act(0, flick(1, 80, 85));
        second.act(0, flick(1, 80, 85));
        assertThat(view(first).lastShot().frames()).isEqualTo(view(second).lastShot().frames());
    }

    @Test
    void 잘못된_튕기기는_거절한다() {
        AlkkagiGame game = new AlkkagiGame(TWO, 4);
        assertThatThrownBy(() -> game.act(1, flick(4, 270, 50))).isInstanceOf(BusinessException.class); // 차례가 아니다
        assertThatThrownBy(() -> game.act(0, flick(4, 90, 50))).isInstanceOf(BusinessException.class); // 상대 알
        assertThatThrownBy(() -> game.act(0, flick(0, 360, 50))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, flick(0, 90, 101))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, new GameAction("FLICK", null, null, List.of(0, 90)))).isInstanceOf(BusinessException.class);
    }
}
