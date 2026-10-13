package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChessGameTest {
    /** "e2" → [행, 열] (0행 = 8랭크) */
    private static int[] square(String name) {
        return new int[] {8 - (name.charAt(1) - '0'), name.charAt(0) - 'a'};
    }

    private static GameAction move(String from, String to) {
        return move(from, to, null);
    }

    private static GameAction move(String from, String to, String promotion) {
        int[] a = square(from);
        int[] b = square(to);
        return new GameAction("MOVE", promotion, null, List.of(a[0], a[1], b[0], b[1]));
    }

    private static ChessGame newGame() {
        return new ChessGame(List.of("백돌이", "흑돌이"));
    }

    private static ChessGame.View view(ChessGame game, Integer seat) {
        return (ChessGame.View) game.viewFor(seat);
    }

    @Test
    void 처음_국면에서_백은_20수를_둘_수_있고_차례인_사람에게만_합법수를_보낸다() {
        ChessGame game = newGame();
        assertThat(game.legalMoves()).hasSize(20);
        assertThat(view(game, 0).legalMoves()).hasSize(20);
        assertThat(view(game, 1).legalMoves()).isEmpty();
        assertThat(view(game, 0).board().get(7)).isEqualTo("RNBQKBNR");
        assertThatThrownBy(() -> game.act(1, move("e7", "e5"))).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_NOT_YOUR_TURN));
        assertThatThrownBy(() -> game.act(0, move("e2", "e5"))).isInstanceOf(BusinessException.class);
    }

    @Test
    void 스콜라스_메이트로_체크메이트하면_백이_이긴다() {
        ChessGame game = newGame();
        game.act(0, move("e2", "e4"));
        game.act(1, move("e7", "e5"));
        game.act(0, move("f1", "c4"));
        game.act(1, move("b8", "c6"));
        game.act(0, move("d1", "h5"));
        game.act(1, move("g8", "f6"));
        game.act(0, move("h5", "f7"));
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).isEqualTo("체스 체크메이트 — 백돌이 승리");
        assertThat(game.winnerSeats()).containsExactly(0);
        assertThat(view(game, null).history()).containsExactly("e2-e4", "e7-e5", "Bf1-c4", "Nb8-c6", "Qd1-h5", "Ng8-f6", "Qh5xf7#");
        assertThat(view(game, null).capturedByWhite()).containsExactly("p");
    }

    @Test
    void 체크를_무시하는_수와_핀된_기물은_움직일_수_없다() {
        ChessGame game = newGame();
        // 백 킹 e1, 백 비숍 e2(핀), 흑 룩 e8
        game.setPosition(new String[] {"....r..k", "........", "........", "........", "........", "........", "....B...", "....K..."}, true);
        assertThatThrownBy(() -> game.act(0, move("e2", "d3"))).isInstanceOf(BusinessException.class);
        game.act(0, move("e1", "d1"));
        assertThat(view(game, null).board().get(7)).isEqualTo("...K....");
    }

    @Test
    void 캐슬링은_사이가_비고_공격받는_칸을_지나지_않을_때만() {
        ChessGame game = newGame();
        game.setPosition(new String[] {"r...k..r", "........", "........", "........", "........", "........", "........", "R...K..R"}, true);
        game.act(0, move("e1", "g1"));
        assertThat(view(game, null).board().get(7)).isEqualTo("R....RK.");
        game.act(1, move("e8", "c8"));
        assertThat(view(game, null).board().get(0)).isEqualTo("..kr...r");
        assertThat(view(game, null).history()).containsExactly("O-O", "O-O-O");

        ChessGame blocked = newGame();
        blocked.setPosition(new String[] {"....k...", "........", "........", "........", "........", "........", ".....r..", "R...K..R"}, true);
        assertThatThrownBy(() -> blocked.act(0, move("e1", "g1"))).isInstanceOf(BusinessException.class); // f1이 흑 룩에게 공격받음
    }

    @Test
    void 앙파상과_프로모션() {
        ChessGame passant = newGame();
        passant.setPosition(new String[] {"....k...", "...p....", "........", "....P...", "........", "........", "........", "....K..."}, false);
        passant.act(1, move("d7", "d5"));
        passant.act(0, move("e5", "d6")); // 앙파상
        assertThat(view(passant, null).board().get(3)).isEqualTo("........"); // d5 흑 폰이 잡혔다
        assertThat(view(passant, null).capturedByWhite()).containsExactly("p");

        ChessGame promote = newGame();
        promote.setPosition(new String[] {"....k...", "P.......", "........", "........", "........", "........", "........", "....K..."}, true);
        promote.act(0, move("a7", "a8", "N"));
        assertThat(view(promote, null).board().get(0)).isEqualTo("N...k...");
    }

    @Test
    void 스테일메이트와_기물_부족은_무승부() {
        ChessGame stale = newGame();
        // 흑 킹 a8, 백 퀸이 b6으로 가면 흑은 둘 수 없지만 체크도 아니다
        stale.setPosition(new String[] {"k.......", "........", "..K.....", "........", "........", "........", "........", ".Q......"}, true);
        stale.act(0, move("b1", "b6"));
        assertThat(stale.isFinished()).isTrue();
        assertThat(stale.resultText()).contains("스테일메이트");
        assertThat(stale.winnerSeats()).isEmpty();

        ChessGame bare = newGame();
        // 백 킹이 마지막 흑 룩을 잡으면 킹 대 킹 → 무승부
        bare.setPosition(new String[] {"k.......", "........", "..K.....", ".r......", "........", "........", "........", "........"}, true);
        bare.act(0, move("c6", "b5"));
        assertThat(bare.isFinished()).isTrue();
        assertThat(bare.resultText()).contains("기물이 모자라");
        assertThat(view(bare, null).winnerSeat()).isNull();
    }
}
