package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OneCardGameTest {
    private static final List<PlayingCard> DECK = PlayingCard.deck(true);

    private static int id(String code) {
        return DECK.stream().filter(card -> card.code().equals(code)).findFirst().orElseThrow().id();
    }

    private static GameAction play(String code) {
        return new GameAction("PLAY", null, id(code), null);
    }

    private static GameAction playSeven(String code, String suit) {
        return new GameAction("PLAY", suit, id(code), null);
    }

    private static final GameAction DRAW = new GameAction("DRAW", null, null, null);

    private static OneCardGame.View view(OneCardGame game, Integer seat) {
        return (OneCardGame.View) game.viewFor(seat);
    }

    private static OneCardGame game(int players, List<List<String>> hands, String top) {
        List<String> names = List.of("철수", "영희", "민수", "지수").subList(0, players);
        OneCardGame game = new OneCardGame(names, new Random(4));
        game.setUp(hands, top);
        return game;
    }

    @Test
    void 처음에_7장씩_받고_남의_손은_장수만_보인다() {
        OneCardGame game = new OneCardGame(List.of("철수", "영희", "민수"), new Random(9));
        assertThat(view(game, 0).myHand()).hasSize(7);
        assertThat(view(game, 0).handCounts()).containsExactly(7, 7, 7);
        assertThat(view(game, null).myHand()).isEmpty();
        assertThat(view(game, 0).drawPileCount()).isLessThanOrEqualTo(54 - 21 - 1);
    }

    @Test
    void 무늬나_숫자가_맞아야_내고_못_내면_한_장_받고_차례가_넘어간다() {
        OneCardGame game = game(2, List.of(List.of("S5", "H9", "D3"), List.of("C4", "C6")), "S9");
        assertThatThrownBy(() -> game.act(0, play("D3"))).isInstanceOf(BusinessException.class);
        game.act(0, play("H9")); // 숫자 9
        assertThat(view(game, 1).top().code()).isEqualTo("H9");
        assertThat(view(game, 1).turnSeat()).isEqualTo(1);
        assertThatThrownBy(() -> game.act(0, play("S5"))).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_NOT_YOUR_TURN));
        game.act(1, DRAW);
        assertThat(view(game, 0).handCounts()).containsExactly(2, 3);
        assertThat(view(game, 0).turnSeat()).isZero();
    }

    @Test
    void 공격은_쌓이고_A_2_조커로_막거나_쌓인_만큼_받는다() {
        OneCardGame game = game(3, List.of(List.of("S2", "H5"), List.of("S1", "D4"), List.of("C9", "C3")), "S7");
        game.act(0, play("S2")); // +2
        assertThat(view(game, 1).attackPenalty()).isEqualTo(2);
        assertThatThrownBy(() -> game.act(1, play("D4"))).isInstanceOf(BusinessException.class); // 공격 중에는 공격 카드만
        game.act(1, play("S1")); // A로 막아 +3 → 5
        assertThat(view(game, 2).attackPenalty()).isEqualTo(5);
        game.act(2, DRAW);
        assertThat(view(game, 0).handCounts().get(2)).isEqualTo(7);
        assertThat(view(game, 0).attackPenalty()).isZero();
    }

    @Test
    void 조커_다음에는_아무_카드나_낼_수_있다() {
        OneCardGame game = game(2, List.of(List.of("CJ", "H5"), List.of("D4", "C9")), "S7");
        game.act(0, play("CJ")); // +7
        assertThat(view(game, 1).attackPenalty()).isEqualTo(7);
        game.act(1, DRAW);
        game.act(0, play("H5")); // 조커 다음이라 아무 무늬나
        assertThat(view(game, 1).currentSuit()).isEqualTo("H");
    }

    @Test
    void 칠은_무늬를_바꾸고_J는_건너뛰고_Q는_거꾸로_K는_한_번_더() {
        OneCardGame game = game(3, List.of(List.of("S7", "H13", "H11", "H4"), List.of("H12", "D2"), List.of("C9", "H3")), "S5");
        assertThatThrownBy(() -> game.act(0, play("S7"))).isInstanceOf(BusinessException.class); // 무늬를 안 골랐다
        game.act(0, playSeven("S7", "H"));
        assertThat(view(game, 1).currentSuit()).isEqualTo("H");
        game.act(1, play("H12")); // Q: 거꾸로 → 다음은 0번
        assertThat(view(game, 0).turnSeat()).isZero();
        assertThat(view(game, 0).direction()).isEqualTo(-1);
        game.act(0, play("H13")); // K: 한 번 더
        assertThat(view(game, 0).turnSeat()).isZero();
        game.act(0, play("H11")); // J: (거꾸로 방향) 2번을 건너뛰고 1번
        assertThat(view(game, 0).turnSeat()).isEqualTo(1);
    }

    @Test
    void 다_내면_순위가_매겨지고_한_명_남으면_끝난다() {
        OneCardGame game = game(2, List.of(List.of("S5"), List.of("C4", "C6")), "S9");
        game.act(0, play("S5"));
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).isEqualTo("원카드 1위 철수 · 2위 영희");
    }

    @Test
    void 공격으로_20장이_넘으면_파산해_뒤_순위가_된다() {
        List<String> big = List.of("C3", "C4", "C5", "C6", "C8", "C9", "C10", "D3", "D4", "D5", "D6", "D8", "D9", "D10", "H3", "H4");
        OneCardGame game = game(3, List.of(List.of("CJ", "S3"), big, List.of("S4", "S6")), "S9");
        game.act(0, play("CJ")); // +7 → 영희 16 + 7 = 23장
        game.act(1, DRAW);
        assertThat(view(game, 0).active()).containsExactly(true, false, true);
        assertThat(view(game, 0).ranks().get(1)).isEqualTo(3);
        assertThat(view(game, 0).turnSeat()).isEqualTo(2);
    }

    @Test
    void 나가면_파산처럼_처리되고_차례면_다음_사람으로() {
        OneCardGame game = game(3, List.of(List.of("S5"), List.of("C4"), List.of("D4")), "S9");
        game.leave(0);
        assertThat(view(game, 1).turnSeat()).isEqualTo(1);
        game.leave(2);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).isEqualTo("원카드 1위 영희 · 2위 민수 · 3위 철수");
        assertThat(game.winnerSeats()).containsExactly(1); // 1위만 승리
    }
}
