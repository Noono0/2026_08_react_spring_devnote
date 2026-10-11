package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BlackjackGameTest {
    private static final List<PlayingCard> DECK = PlayingCard.deck(false);

    private static PlayingCard card(String code) {
        return DECK.stream().filter(candidate -> candidate.code().equals(code)).findFirst().orElseThrow();
    }

    /** 앞에 정한 카드를 놓고, 뒤에 한 벌을 더 붙여 판이 끝날 때까지 모자라지 않게 한다 */
    private static List<PlayingCard> stack(String... codes) {
        List<PlayingCard> cards = new ArrayList<>();
        for (String code : codes) cards.add(card(code));
        cards.addAll(DECK);
        return cards;
    }

    private static GameAction bet(int amount) {
        return new GameAction("BET", null, amount, null);
    }

    private static GameAction decision(String name) {
        return new GameAction(name, null, null, null);
    }

    private static BlackjackGame.View view(BlackjackGame game, Integer seat) {
        return (BlackjackGame.View) game.viewFor(seat);
    }

    @Test
    void 점수는_A를_11이나_1로_세고_그림은_10이다() {
        assertThat(BlackjackGame.value(List.of(card("S1"), card("H13")))).isEqualTo(21);
        assertThat(BlackjackGame.value(List.of(card("S1"), card("H1"), card("D9")))).isEqualTo(21);
        assertThat(BlackjackGame.value(List.of(card("S10"), card("H12"), card("D5")))).isEqualTo(25);
        assertThat(BlackjackGame.isBlackjack(List.of(card("S1"), card("H11")))).isTrue();
        assertThat(BlackjackGame.isBlackjack(List.of(card("S7"), card("H7"), card("D7")))).isFalse();
    }

    @Test
    void 모두_걸어야_카드를_나누고_딜러의_두_번째_카드는_숨긴다() {
        BlackjackGame game = new BlackjackGame(List.of("철수", "영희"), new Random(1));
        // 나누는 순서: 철수·영희·딜러, 철수·영희·딜러
        game.stackShoe(stack("S10", "H9", "D10", "S7", "H8", "D9"));
        assertThatThrownBy(() -> game.act(0, bet(5))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, bet(2000))).isInstanceOf(BusinessException.class);
        game.act(0, bet(100));
        assertThat(view(game, 0).phase()).isEqualTo("BETTING");
        game.act(1, bet(50));
        var view = view(game, 1);
        assertThat(view.phase()).isEqualTo("PLAYING");
        assertThat(view.handValues()).containsExactly(17, 17);
        assertThat(view.dealerCards()).hasSize(2);
        assertThat(view.dealerCards().get(1)).isNull();
        assertThat(view.dealerValue()).isEqualTo(10); // 보이는 한 장만
        assertThat(view.turnSeat()).isZero();
    }

    @Test
    void 받기_멈추기_차례가_넘어가고_딜러는_17까지_받은_뒤_정산한다() {
        BlackjackGame game = new BlackjackGame(List.of("철수", "영희"), new Random(1));
        // 철수 10+6, 영희 10+9, 딜러 10+6 → 철수 받기(5)=21, 영희 멈춤, 딜러 16 → 받기(8) 24 버스트
        game.stackShoe(stack("S10", "H10", "D10", "S6", "H9", "D6", "S5", "C8"));
        game.act(0, bet(100));
        game.act(1, bet(200));
        assertThatThrownBy(() -> game.act(1, decision("STAND"))).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_NOT_YOUR_TURN));
        game.act(0, decision("HIT")); // 21 → 자동으로 끝
        assertThat(view(game, 0).turnSeat()).isEqualTo(1);
        game.act(1, decision("STAND"));
        var view = view(game, 0);
        assertThat(view.phase()).isEqualTo("BETTING");
        assertThat(view.round()).isEqualTo(2);
        assertThat(view.lastResults()).containsExactly(new BlackjackGame.RoundResult(100, "딜러 버스트"), new BlackjackGame.RoundResult(200, "딜러 버스트"));
        assertThat(view.chips()).containsExactly(1100, 1200);
        assertThat(view.lastDealerCards()).extracting(PlayingCard.View::code).containsExactly("D10", "D6", "C8");
    }

    @Test
    void 블랙잭은_1점5배_버스트는_건_만큼_잃는다() {
        BlackjackGame game = new BlackjackGame(List.of("철수", "영희"), new Random(1));
        // 철수 A+K 블랙잭, 영희 10+8 → 받기 9 버스트, 딜러 10+9 = 19
        game.stackShoe(stack("S1", "H10", "D10", "S13", "H8", "D9", "C9"));
        game.act(0, bet(100));
        game.act(1, bet(100));
        assertThat(view(game, 0).turnSeat()).isEqualTo(1); // 철수는 블랙잭이라 바로 끝
        game.act(1, decision("HIT"));
        var view = view(game, 0);
        assertThat(view.lastResults()).containsExactly(new BlackjackGame.RoundResult(150, "블랙잭"), new BlackjackGame.RoundResult(-100, "버스트"));
        assertThat(view.chips()).containsExactly(1150, 900);
    }

    @Test
    void 더블은_처음_두_장일_때만_베팅을_2배로_한_장만_받는다() {
        BlackjackGame game = new BlackjackGame(List.of("철수"), new Random(1));
        // 철수 5+6 → 더블 10 = 21, 딜러 10+8 = 18 → 철수 승 200
        game.stackShoe(stack("S5", "D10", "S6", "D8", "H10"));
        game.act(0, bet(100));
        game.act(0, decision("DOUBLE"));
        assertThat(view(game, 0).chips()).containsExactly(1200);
        assertThat(view(game, 0).lastResults()).containsExactly(new BlackjackGame.RoundResult(200, "승"));
    }

    @Test
    void 다섯_판_뒤_칩이_가장_많은_사람이_이긴다() {
        BlackjackGame game = new BlackjackGame(List.of("철수"), new Random(3));
        for (int round = 0; round < BlackjackGame.MAX_ROUNDS; round++) {
            game.act(0, bet(10));
            while (view(game, 0).phase().equals("PLAYING")) game.act(0, decision("STAND"));
        }
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).startsWith("블랙잭 1위 철수");
    }

    @Test
    void 차례인_사람이_나가면_다음_사람으로_넘어간다() {
        BlackjackGame game = new BlackjackGame(List.of("철수", "영희"), new Random(1));
        game.stackShoe(stack("S10", "H10", "D10", "S6", "H7", "D7"));
        game.act(0, bet(100));
        game.act(1, bet(100));
        game.leave(0);
        assertThat(view(game, 1).turnSeat()).isEqualTo(1);
    }
}
