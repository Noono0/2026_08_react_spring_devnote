package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SutdaGameTest {
    private static SutdaGame.Card card(String code) {
        int month = Integer.parseInt(code.substring(0, code.length() - 1));
        return new SutdaGame.Card(month, !code.endsWith("B"));
    }

    private static SutdaGame.Hand rank(String first, String second) {
        return SutdaGame.rank(card(first), card(second));
    }

    private static List<List<SutdaGame.Card>> hands(String... pairs) {
        List<List<SutdaGame.Card>> hands = new ArrayList<>();
        for (String pair : pairs) {
            String[] codes = pair.split(",");
            hands.add(List.of(card(codes[0]), card(codes[1])));
        }
        return hands;
    }

    private static GameAction act(String name) {
        return new GameAction(name, null, null, null);
    }

    private static SutdaGame.View view(SutdaGame game, Integer seat) {
        return (SutdaGame.View) game.viewFor(seat);
    }

    @Test
    void 족보_순서() {
        assertThat(rank("3G", "8G").name()).isEqualTo("38광땡");
        assertThat(rank("1G", "8G").name()).isEqualTo("18광땡");
        assertThat(rank("3B", "8G").name()).isEqualTo("1끗"); // 광이 아니면 광땡이 아니다
        assertThat(rank("10A", "10B").name()).isEqualTo("장땡");
        assertThat(rank("1G", "2B").name()).isEqualTo("알리");
        assertThat(rank("4Y", "6B").name()).isEqualTo("세륙");
        assertThat(rank("5B", "4B").name()).isEqualTo("갑오");
        assertThat(rank("2B", "8B").name()).isEqualTo("망통");
        assertThat(rank("3G", "8G").score()).isGreaterThan(rank("1G", "3G").score());
        assertThat(rank("1G", "3G").score()).isGreaterThan(rank("10A", "10B").score());
        assertThat(rank("10A", "10B").score()).isGreaterThan(rank("9Y", "9B").score());
        assertThat(rank("1B", "1G").score()).isGreaterThan(rank("1G", "2B").score()); // 1땡 > 알리
        assertThat(rank("4Y", "6B").score()).isGreaterThan(rank("5B", "4B").score()); // 세륙 > 갑오
    }

    @Test
    void 암행어사는_광땡을_잡고_땡잡이는_1부터_9땡을_잡는다() {
        assertThat(SutdaGame.showdown(hands("4Y,7Y", "1G,8G"), List.of(0, 1))).containsExactly(0);
        assertThat(SutdaGame.showdown(hands("4Y,7Y", "3G,8G"), List.of(0, 1))).containsExactly(1); // 38광땡은 못 잡는다
        assertThat(SutdaGame.showdown(hands("3G,7Y", "9Y,9B"), List.of(0, 1))).containsExactly(0);
        assertThat(SutdaGame.showdown(hands("3G,7Y", "10A,10B"), List.of(0, 1))).containsExactly(1); // 장땡은 못 잡는다
        assertThat(SutdaGame.showdown(hands("3G,7Y", "5B,4B"), List.of(0, 1))).containsExactly(1); // 평소에는 망통
    }

    @Test
    void 구사는_상대가_알리_이하면_다시_하고_멍텅구리구사는_9땡_이하면_다시_한다() {
        assertThat(SutdaGame.showdown(hands("4B,9B", "1G,2B"), List.of(0, 1))).isNull();
        assertThat(SutdaGame.showdown(hands("4B,9B", "2A,2B"), List.of(0, 1))).containsExactly(1);
        assertThat(SutdaGame.showdown(hands("4Y,9Y", "9A,9B"), List.of(0, 1))).isNull();
        assertThat(SutdaGame.showdown(hands("4Y,9Y", "10A,10B"), List.of(0, 1))).containsExactly(1);
    }

    @Test
    void 같은_족보면_판돈을_나눈다() {
        assertThat(SutdaGame.showdown(hands("5B,4B", "6A,3B"), List.of(0, 1))).containsExactly(0, 1);
    }

    @Test
    void 판돈을_내고_두_장씩_받으며_남의_패는_보이지_않는다() {
        SutdaGame game = new SutdaGame(List.of("철수", "영희", "민수"), new Random(5));
        var view = view(game, 0);
        assertThat(view.myCards()).hasSize(2);
        assertThat(view.chips()).containsExactly(990, 990, 990);
        assertThat(view.pot()).isEqualTo(30);
        assertThat(view(game, null).myCards()).isEmpty();
        assertThat(view.turnSeat()).isEqualTo(1); // 딜러(0번) 다음부터
    }

    @Test
    void 내_패의_족보_이름을_알려_주고_구사와_멍텅구리구사를_구분한다() {
        SutdaGame game = new SutdaGame(List.of("철수", "영희"), new Random(5));
        game.setHands(List.of(List.of("4Y", "9Y"), List.of("4B", "9Y")));
        assertThat(view(game, 0).myHandName()).isEqualTo("멍텅구리구사");
        assertThat(view(game, 1).myHandName()).isEqualTo("구사");
        assertThat(view(game, 0).mode()).isEqualTo("TWO");
        assertThat(view(game, 0).myCombos()).isEmpty();
    }

    @Test
    void 세_장_섯다는_첫_베팅_뒤_한_장을_더_받고_두_장을_골라_비교한다() {
        SutdaGame game = new SutdaGame(List.of("철수", "영희"), new Random(5), SutdaGame.Mode.THREE);
        game.setHands(List.of(List.of("3G", "2B"), List.of("5B", "6B")));
        game.putOnTopOfDeck(List.of("8G", "1G")); // 철수 3번째 = 8광, 영희 3번째 = 1광
        assertThat(view(game, 0).myHandName()).isEqualTo("5끗"); // 두 장일 때의 족보
        game.act(1, act("CHECK"));
        game.act(0, act("CHECK"));

        var choosing = view(game, 0);
        assertThat(choosing.phase()).isEqualTo("CHOOSE");
        assertThat(choosing.myCards()).containsExactly("3G", "2B", "8G");
        assertThat(choosing.myCombos()).extracting(SutdaGame.Combo::name).containsExactly("5끗", "38광땡", "망통"); // 3+2, 3광+8광, 2+8=10
        assertThat(choosing.pot()).isEqualTo(20); // 첫 바퀴 칩이 판돈으로 옮겨지고 두 번 세지 않는다
        assertThatThrownBy(() -> game.act(1, act("CHECK"))).isInstanceOf(BusinessException.class); // 고르기 전에는 베팅 불가
        assertThatThrownBy(() -> game.act(0, new GameAction("CHOOSE", null, null, List.of(1, 1)))).isInstanceOf(BusinessException.class);

        game.act(0, new GameAction("CHOOSE", null, null, List.of(0, 2)));
        assertThat(view(game, 1).chosen()).containsExactly(true, false); // 누가 골랐는지만 보이고 무엇을 골랐는지는 숨긴다
        assertThat(view(game, 0).myHandName()).isEqualTo("38광땡");
        game.act(1, new GameAction("CHOOSE", null, null, List.of(0, 1))); // 5·6 = 1끗
        assertThat(view(game, 0).phase()).isEqualTo("BETTING");

        game.act(1, act("CHECK"));
        game.act(0, act("CHECK"));
        var last = view(game, 1).lastRound();
        assertThat(last.cards().get(0)).containsExactly("3G", "8G"); // 고른 두 장만 공개
        assertThat(last.handNames()).containsExactly("38광땡", "1끗");
        assertThat(last.winners()).containsExactly(0);
    }

    @Test
    void 세_장_섯다에서_첫_베팅에_다이하면_세_번째_패_없이_끝난다() {
        SutdaGame game = new SutdaGame(List.of("철수", "영희"), new Random(5), SutdaGame.Mode.THREE);
        game.act(1, act("FOLD"));
        var view = view(game, 0);
        assertThat(view.round()).isEqualTo(2);
        assertThat(view.lastRound().winners()).containsExactly(0);
        assertThat(view.myCards()).hasSize(2); // 새 판은 다시 두 장부터
    }

    @Test
    void 다이로_혼자_남으면_판돈을_가져가고_다음_판이_시작된다() {
        SutdaGame game = new SutdaGame(List.of("철수", "영희"), new Random(5));
        game.act(1, new GameAction("RAISE", null, 50, null));
        game.act(0, act("FOLD"));
        var view = view(game, 0);
        assertThat(view.round()).isEqualTo(2);
        assertThat(view.lastRound().winners()).containsExactly(1);
        assertThat(view.lastRound().cards().get(1)).isEmpty(); // 혼자 남으면 패를 공개하지 않는다
        assertThat(view.chips()).containsExactly(990 - 10, 990 - 50 + 70 - 10); // 영희: 레이즈 50 → 판돈 70 받음 → 2판 판돈 10
    }

    @Test
    void 끝까지_가면_패를_공개해_높은_사람이_가져간다() {
        SutdaGame game = new SutdaGame(List.of("철수", "영희"), new Random(5));
        game.setHands(List.of(List.of("1G", "2B"), List.of("5B", "4B"))); // 알리 vs 갑오
        game.act(1, act("CHECK"));
        game.act(0, new GameAction("RAISE", null, 30, null));
        game.act(1, act("CALL"));
        var last = view(game, 1).lastRound();
        assertThat(last.winners()).containsExactly(0);
        assertThat(last.handNames()).containsExactly("알리", "갑오");
        assertThat(last.pot()).isEqualTo(80);
        assertThatThrownBy(() -> game.act(0, new GameAction("PEEK", null, null, null))).isInstanceOf(BusinessException.class);
    }

    @Test
    void 여섯_판이_끝나면_칩이_많은_사람이_이긴다() {
        SutdaGame game = new SutdaGame(List.of("철수", "영희"), new Random(8));
        for (int round = 0; round < SutdaGame.MAX_ROUNDS * 3 && !game.isFinished(); round++) {
            var view = view(game, 0);
            game.act(view.turnSeat(), act(view(game, view.turnSeat()).toCall() > 0 ? "CALL" : "CHECK"));
        }
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).startsWith("섯다 1위");
    }
}
