package com.example.devnote.online.domain.game;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class PokerGameTest {
    private static final List<PlayingCard> DECK = PlayingCard.deck(false);

    private static List<PlayingCard> cards(String codes) {
        return Arrays.stream(codes.split(" ")).map(code -> DECK.stream().filter(card -> card.code().equals(code)).findFirst().orElseThrow()).toList();
    }

    private static PokerHands.Result best(String codes) {
        return PokerHands.best(cards(codes));
    }

    private static GameAction act(String name) {
        return new GameAction(name, null, null, null);
    }

    private static PokerGame.View view(PokerGame game, Integer seat) {
        return (PokerGame.View) game.viewFor(seat);
    }

    @Test
    void 족보_이름과_순서() {
        assertThat(best("S1 S13 S12 S11 S10 H2 D3").name()).isEqualTo("로열 플러시");
        assertThat(best("S9 S8 S7 S6 S5 H2 D3").name()).isEqualTo("스트레이트 플러시");
        assertThat(best("S9 H9 D9 C9 S5 H2 D3").name()).isEqualTo("포카드");
        assertThat(best("S9 H9 D9 C5 S5 H2 D3").name()).isEqualTo("풀하우스");
        assertThat(best("S2 S9 S7 S4 S5 H2 D3").name()).isEqualTo("플러시");
        assertThat(best("S1 H2 D3 C4 S5 H9 D11").name()).isEqualTo("스트레이트"); // A-2-3-4-5
        assertThat(best("S9 H9 D9 C4 S5 H2 D12").name()).isEqualTo("트리플");
        assertThat(best("S9 H9 D4 C4 S5 H2 D12").name()).isEqualTo("투페어");
        assertThat(best("S9 H9 D4 C7 S5 H2 D12").name()).isEqualTo("원페어");
        assertThat(best("S9 H8 D4 C7 S13 H2 D12").name()).isEqualTo("하이카드");
    }

    @Test
    void 같은_족보면_높은_숫자와_키커로_가린다() {
        assertThat(best("S13 H13 D9 C7 S4 H2 D3").score()).isGreaterThan(best("S12 H12 D1 C7 S4 H2 D3").score()); // K 원페어 > Q 원페어
        assertThat(best("S13 H13 D9 C7 S4 H2 D3").score()).isLessThan(best("C13 D13 D10 C7 S4 H2 D3").score()); // 키커 10 > 9
        assertThat(best("S1 H2 D3 C4 S5 H9 D11").score()).isLessThan(best("S2 H3 D4 C5 S6 H9 D11").score()); // 5 하이 < 6 하이 스트레이트
        assertThat(best("S10 H10 D10 C2 S2 H9 D11").score()).isGreaterThan(best("S9 H9 D9 C13 S13 H4 D5").score()); // 풀하우스는 트리플 숫자 먼저
    }

    @Test
    void 블라인드를_내고_둘이면_딜러가_스몰이자_먼저_결정한다() {
        PokerGame game = new PokerGame(List.of("철수", "영희"), new Random(1));
        var view = view(game, 0);
        assertThat(view.chips()).containsExactly(990, 980);
        assertThat(view.pot()).isEqualTo(30);
        assertThat(view.turnSeat()).isZero();
        assertThat(view.toCall()).isEqualTo(10);
        assertThat(view.street()).isEqualTo("프리플랍");
        assertThat(view.myCards()).hasSize(2);
        assertThat(view(game, null).myCards()).isEmpty();
    }

    @Test
    void 모두_맞추면_플랍_턴_리버로_넘어가고_끝까지_가면_좋은_패가_가져간다() {
        PokerGame game = new PokerGame(List.of("철수", "영희"), new Random(1));
        game.setCards(List.of(List.of("S1", "H1"), List.of("S13", "D7")), List.of("C1", "D2", "S9", "H4", "C11"));
        game.act(0, act("CALL"));
        game.act(1, act("CHECK")); // 빅 블라인드의 선택
        assertThat(view(game, 0).street()).isEqualTo("플랍");
        assertThat(view(game, 0).board()).extracting(PlayingCard.View::code).containsExactly("C1", "D2", "S9");
        assertThat(view(game, 0).turnSeat()).isEqualTo(1); // 플랍부터는 딜러 다음 사람이 먼저
        for (int street = 0; street < 3; street++) {
            game.act(1, act("CHECK"));
            game.act(0, act("CHECK"));
        }
        var last = view(game, 0).lastHand();
        assertThat(last.winners()).containsExactly(0);
        assertThat(last.handNames().get(0)).isEqualTo("트리플");
        assertThat(last.pot()).isEqualTo(40);
        assertThat(view(game, 0).handNumber()).isEqualTo(2);
    }

    @Test
    void 폴드하면_남은_사람이_패를_공개하지_않고_가져간다() {
        PokerGame game = new PokerGame(List.of("철수", "영희", "민수"), new Random(2));
        // 3명: 딜러 0, 스몰 1, 빅 2 → 먼저 결정은 0번
        assertThat(view(game, 0).turnSeat()).isZero();
        game.act(0, act("FOLD"));
        game.act(1, act("FOLD"));
        var last = view(game, 0).lastHand();
        assertThat(last.winners()).containsExactly(2);
        assertThat(last.cards().get(2)).isEmpty();
    }

    @Test
    void 여섯_판이_끝나면_칩이_많은_사람이_이기고_칩_합계는_그대로다() {
        PokerGame game = new PokerGame(List.of("철수", "영희", "민수"), new Random(4));
        for (int step = 0; step < 500 && !game.isFinished(); step++) {
            var view = view(game, 0);
            int seat = view.turnSeat();
            game.act(seat, act(view(game, seat).toCall() > 0 ? "CALL" : "CHECK"));
        }
        assertThat(game.isFinished()).isTrue();
        assertThat(view(game, null).chips().stream().mapToInt(Integer::intValue).sum()).isEqualTo(3000);
        assertThat(game.resultText()).startsWith("포커 1위");
    }
}
