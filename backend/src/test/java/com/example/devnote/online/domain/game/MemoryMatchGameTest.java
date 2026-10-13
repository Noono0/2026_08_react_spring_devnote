package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MemoryMatchGameTest {
    private static GameAction flip(int card) {
        return new GameAction("FLIP", null, card, null);
    }

    private static MemoryMatchGame.View view(MemoryMatchGame game, Integer seat) {
        return (MemoryMatchGame.View) game.viewFor(seat);
    }

    /** 0·1번이 첫 짝, 2·3번이 둘째 짝 … 순서대로 놓은 2인용(8쌍) 카드 */
    private static MemoryMatchGame orderedGame() {
        MemoryMatchGame game = new MemoryMatchGame(List.of("철수", "영희"), new Random(1));
        List<String> ordered = new ArrayList<>();
        for (String symbol : MemoryMatchGame.SYMBOLS.subList(0, 8)) {
            ordered.add(symbol);
            ordered.add(symbol);
        }
        game.setCards(ordered);
        return game;
    }

    @Test
    void 인원에_따라_짝_수가_정해지고_뒷면_카드의_그림은_보내지_않는다() {
        assertThat(MemoryMatchGame.pairsFor(2)).isEqualTo(8);
        assertThat(MemoryMatchGame.pairsFor(3)).isEqualTo(10);
        assertThat(MemoryMatchGame.pairsFor(4)).isEqualTo(12);
        MemoryMatchGame game = new MemoryMatchGame(List.of("가", "나", "다", "라"), new Random(5));
        assertThat(view(game, 0).cards()).hasSize(24).allMatch(card -> card.symbol() == null);
        assertThat(view(game, 0).columns()).isEqualTo(6);
    }

    @Test
    void 짝을_맞히면_점수를_얻고_한_번_더_한다() {
        MemoryMatchGame game = orderedGame();
        game.act(0, flip(0));
        assertThat(view(game, 1).cards().get(0)).isEqualTo(new MemoryMatchGame.CardView("🍎", null, true));
        game.act(0, flip(1));
        assertThat(view(game, 1).scores()).containsExactly(1, 0);
        assertThat(view(game, 1).cards().get(0).matchedBy()).isZero();
        assertThat(view(game, 1).turnSeat()).isZero(); // 한 번 더
        assertThat(game.drainAnnouncements()).anyMatch(text -> text.contains("짝을 맞혔습니다"));
    }

    @Test
    void 틀리면_차례가_넘어가고_틀린_두_장은_다음_사람이_뒤집을_때_덮인다() {
        MemoryMatchGame game = orderedGame();
        game.act(0, flip(0));
        game.act(0, flip(2)); // 🍎 vs 🍌
        assertThat(view(game, 1).turnSeat()).isEqualTo(1);
        assertThat(view(game, 1).cards().get(2).faceUp()).isTrue(); // 아직 보인다
        assertThatThrownBy(() -> game.act(0, flip(4))).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_NOT_YOUR_TURN));
        game.act(1, flip(4));
        assertThat(view(game, 0).cards().get(0).symbol()).isNull(); // 덮였다
        assertThat(view(game, 0).cards().get(4).faceUp()).isTrue();
    }

    @Test
    void 이미_맞춘_카드나_방금_뒤집은_카드는_다시_뒤집을_수_없다() {
        MemoryMatchGame game = orderedGame();
        game.act(0, flip(0));
        assertThatThrownBy(() -> game.act(0, flip(0))).isInstanceOf(BusinessException.class);
        game.act(0, flip(1));
        assertThatThrownBy(() -> game.act(0, flip(1))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, flip(16))).isInstanceOf(BusinessException.class);
    }

    @Test
    void 모두_맞추면_가장_많이_맞힌_사람이_이기고_끝나면_모든_카드를_보여_준다() {
        MemoryMatchGame game = orderedGame();
        for (int pair = 0; pair < 5; pair++) {
            game.act(0, flip(pair * 2));
            game.act(0, flip(pair * 2 + 1));
        }
        game.act(0, flip(10));
        game.act(0, flip(12)); // 틀림 → 영희 차례
        for (int pair = 5; pair < 8; pair++) {
            game.act(1, flip(pair * 2));
            game.act(1, flip(pair * 2 + 1));
        }
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).isEqualTo("카드 짝 맞추기 철수 승리 (5쌍)");
        assertThat(view(game, null).cards()).allMatch(card -> card.symbol() != null);
    }

    @Test
    void 차례인_사람이_나가면_다음_사람으로_넘기고_혼자_남으면_그_사람이_이긴다() {
        MemoryMatchGame game = new MemoryMatchGame(List.of("철수", "영희", "민수"), new Random(2));
        game.leave(0);
        assertThat(view(game, 1).turnSeat()).isEqualTo(1);
        game.leave(2);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).startsWith("카드 짝 맞추기 영희 승리");
    }
}
