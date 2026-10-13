package com.example.devnote.online.domain.game.billiards;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.online.domain.game.GameAction;
import com.example.devnote.online.domain.game.billiards.BilliardsGame.Variant;
import com.example.devnote.online.domain.game.billiards.BilliardsGame.View;
import com.example.devnote.online.domain.game.billiards.BilliardsPhysics.Event;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BilliardsGameTest {
    private static BilliardsGame game(Variant variant) {
        return new BilliardsGame(List.of("철수", "영희"), variant, new Random(3));
    }

    private static View view(BilliardsGame game, Integer seat) {
        return (View) game.viewFor(seat);
    }

    private static Event cushion(int time, int ball) {
        return new Event(time, "CUSHION", ball, 0);
    }

    private static Event hit(int time, int a, int b) {
        return new Event(time, "BALL", a, b);
    }

    private static Event pocket(int time, int ball) {
        return new Event(time, "POCKET", ball, 0);
    }

    private static GameAction shot(int angle, int power, int side, int vertical) {
        return new GameAction("SHOT", null, null, List.of(angle, power, side, vertical));
    }

    @Test
    void 공_배치와_차례_검사() {
        BilliardsGame carom = game(Variant.THREE_CUSHION);
        View start = view(carom, 0);
        assertThat(start.balls()).hasSize(3);
        assertThat(start.tableLength()).isEqualTo(2844);
        assertThat(start.cueBalls()).containsExactly(0, 1);
        assertThat(start.turnSeat()).isZero();
        assertThatThrownBy(() -> carom.act(1, shot(0, 50, 0, 0))).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_NOT_YOUR_TURN));
        assertThatThrownBy(() -> carom.act(0, shot(0, 50, 40, 40))).isInstanceOf(BusinessException.class); // 당점이 원 밖

        BilliardsGame pool = game(Variant.EIGHT_BALL);
        View rack = view(pool, null);
        assertThat(rack.balls()).hasSize(16);
        assertThat(rack.pockets()).isTrue();
        // 8번은 랙 가운데(풋 스폿에서 두 줄 뒤)
        BilliardsGame.BallView eight = rack.balls().stream().filter(ball -> ball.id() == 8).findFirst().orElseThrow();
        assertThat(eight.y()).isEqualTo(635);
    }

    @Test
    void 쓰리쿠션은_두_번째_공_전에_쿠션_3번이면_득점하고_계속_친다() {
        BilliardsGame game = game(Variant.THREE_CUSHION);
        String miss = game.judgeCarom(0, List.of(hit(10, 0, 2), cushion(20, 0), cushion(30, 0), hit(40, 0, 1), cushion(50, 0)));
        assertThat(miss).contains("쿠션이 2번뿐");
        assertThat(view(game, null).turnSeat()).isEqualTo(1);

        String scored = game.judgeCarom(1, List.of(cushion(5, 1), hit(10, 1, 2), cushion(20, 1), cushion(30, 1), hit(40, 1, 0)));
        assertThat(scored).contains("3쿠션 성공");
        assertThat(view(game, null).scores()).containsExactly(0, 1);
        assertThat(view(game, null).turnSeat()).isEqualTo(1);
        // 수구가 아닌 공끼리 부딪친 것과 수구가 아닌 공의 쿠션은 세지 않는다
        game.judgeCarom(1, List.of(hit(10, 1, 2), cushion(15, 2), cushion(16, 2), cushion(17, 2), hit(20, 2, 0), hit(40, 1, 0)));
        assertThat(view(game, null).scores()).containsExactly(0, 1);
    }

    @Test
    void 사구는_빨간_공_둘이면_득점_상대_공을_맞히면_감점() {
        BilliardsGame game = game(Variant.FOUR_BALL);
        game.judgeCarom(0, List.of(hit(10, 0, 2), hit(20, 0, 3)));
        game.judgeCarom(0, List.of(hit(10, 0, 3), hit(20, 0, 2)));
        assertThat(view(game, null).scores()).containsExactly(2, 0);
        String foul = game.judgeCarom(0, List.of(hit(10, 0, 2), hit(20, 0, 1), hit(30, 0, 3)));
        assertThat(foul).contains("1점 잃음");
        assertThat(view(game, null).scores()).containsExactly(1, 0);
        assertThat(view(game, null).turnSeat()).isEqualTo(1);
    }

    @Test
    void 목표_점수에_닿으면_이긴다() {
        BilliardsGame game = game(Variant.FOUR_BALL);
        for (int point = 0; point < BilliardsGame.TARGET_SCORE; point++) game.judgeCarom(0, List.of(hit(10, 0, 2), hit(20, 0, 3)));
        assertThat(game.isFinished()).isTrue();
        assertThat(view(game, null).winners()).containsExactly(0);
        assertThat(game.resultText()).isEqualTo("당구(4구) 철수 승리 (철수 10 : 영희 0)");
    }

    @Test
    void 팔볼_무리_정하기와_파울_뒤_수구_놓기() {
        BilliardsGame game = game(Variant.EIGHT_BALL);
        game.setShotCount(2); // 브레이크는 지났다
        String result = game.judgeEightBall(0, List.of(hit(10, 0, 3), pocket(30, 3)), Set.of());
        assertThat(result).contains("1개 넣음");
        assertThat(view(game, null).groups()).containsExactly("SOLID", "STRIPE");
        assertThat(view(game, null).turnSeat()).isZero(); // 넣었으니 계속

        game.removeBall(3);
        String foul = game.judgeEightBall(0, List.of(hit(10, 0, 12), cushion(20, 12)), Set.of(3));
        assertThat(foul).contains("내 무리가 아님");
        View afterFoul = view(game, 1);
        assertThat(afterFoul.turnSeat()).isEqualTo(1);
        assertThat(afterFoul.ballInHand()).isTrue();
        assertThatThrownBy(() -> game.act(1, new GameAction("PLACE", null, null, List.of(10, 10)))).isInstanceOf(BusinessException.class);
        game.act(1, new GameAction("PLACE", null, null, List.of(600, 300)));
        assertThat(view(game, 1).balls().get(0).x()).isEqualTo(600);
    }

    @Test
    void 팔볼_무리를_다_넣기_전에_8번을_넣으면_진다() {
        BilliardsGame game = game(Variant.EIGHT_BALL);
        game.setShotCount(2);
        game.judgeEightBall(0, List.of(hit(10, 0, 3), pocket(30, 3)), Set.of());
        game.judgeEightBall(0, List.of(hit(10, 0, 1), hit(20, 1, 8), pocket(30, 8)), Set.of(3));
        assertThat(game.isFinished()).isTrue();
        assertThat(view(game, null).winners()).containsExactly(1);
    }

    @Test
    void 팔볼_내_무리를_다_넣고_8번을_넣으면_이긴다() {
        BilliardsGame game = game(Variant.EIGHT_BALL);
        game.setShotCount(2);
        game.judgeEightBall(0, List.of(hit(10, 0, 3), pocket(30, 3)), Set.of());
        for (int id = 1; id <= 7; id++) game.removeBall(id);
        game.judgeEightBall(0, List.of(hit(10, 0, 8), pocket(30, 8)), Set.of(1, 2, 3, 4, 5, 6, 7));
        assertThat(game.isFinished()).isTrue();
        assertThat(view(game, null).winners()).containsExactly(0);
    }

    @Test
    void 브레이크샷을_실제로_치면_궤적과_결과가_나온다() {
        BilliardsGame game = game(Variant.EIGHT_BALL);
        game.act(0, shot(0, 100, 0, 0));
        View after = view(game, 0);
        assertThat(after.lastShot().seq()).isEqualTo(1);
        assertThat(after.lastShot().frames()).hasSizeGreaterThan(10);
        assertThat(after.lastShot().frames().get(0)).hasSize(32);
        assertThat(after.lastShot().events()).anyMatch(event -> event.type().equals("BALL") && event.a() == 0);
        assertThat(game.drainAnnouncements()).isNotEmpty();
    }

    @Test
    void 혼자_치는_연습과_기권() {
        BilliardsGame solo = new BilliardsGame(List.of("철수"), Variant.THREE_CUSHION, new Random(1));
        solo.judgeCarom(0, List.of(hit(10, 0, 2)));
        assertThat(view(solo, 0).turnSeat()).isZero();
        assertThat(view(solo, 0).innings()).containsExactly(2);
        solo.leave(0);
        assertThat(solo.isFinished()).isTrue();

        BilliardsGame duel = game(Variant.THREE_CUSHION);
        duel.leave(0);
        assertThat(view(duel, null).winners()).containsExactly(1);
    }
}
