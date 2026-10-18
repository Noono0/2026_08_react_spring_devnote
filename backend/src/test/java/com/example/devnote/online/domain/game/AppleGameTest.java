package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AppleGameTest {
    private static final List<String> TWO = List.of("철수", "영희");

    /** 첫 줄만 [1, 9, 5, 5, 3, 7, ...], 나머지는 모두 1인 판 */
    private static int[][] board() {
        int[][] board = new int[AppleGame.ROWS][AppleGame.COLUMNS];
        for (int[] row : board) java.util.Arrays.fill(row, 1);
        int[] first = {1, 9, 5, 5, 3, 7};
        System.arraycopy(first, 0, board[0], 0, first.length);
        return board;
    }

    private static GameAction select(int row1, int col1, int row2, int col2) {
        return new GameAction("SELECT", null, null, List.of(row1, col1, row2, col2));
    }

    private static AppleGame.View view(AppleGame game, Integer seat) {
        return (AppleGame.View) game.viewFor(seat);
    }

    @Test
    void 합이_10이면_내_판에서만_사과가_사라지고_개수만큼_점수를_얻는다() {
        AppleGame game = new AppleGame(TWO, board());
        game.act(0, select(0, 1, 0, 0)); // 1 + 9 (두 칸 순서는 상관없다)
        AppleGame.View mine = view(game, 0);
        assertThat(mine.myBoard().get(0)).startsWith("005537");
        assertThat(mine.scores()).containsExactly(2, 0);
        assertThat(mine.remaining()).containsExactly(168, 170);
        assertThat(view(game, 1).myBoard().get(0)).startsWith("195537"); // 상대 판은 그대로
        assertThat(view(game, null).myBoard()).isEmpty(); // 관전자는 판을 받지 않는다

        game.act(0, select(0, 0, 0, 3)); // 남은 5 + 5 = 10 (없앤 칸은 빼고 센다)
        assertThat(view(game, 0).scores()).containsExactly(4, 0);
        game.act(0, select(0, 4, 0, 4)); // 3 하나 → 10이 아니면 아무 일 없음(오류 아님)
        assertThat(view(game, 0).scores()).containsExactly(4, 0);
    }

    @Test
    void 잘못된_요청과_판_밖은_거절한다() {
        AppleGame game = new AppleGame(TWO, board());
        assertThatThrownBy(() -> game.act(0, select(0, 0, 10, 0))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, new GameAction("SELECT", null, null, List.of(0, 0)))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, new GameAction("CLICK", null, null, null))).isInstanceOf(BusinessException.class);
    }

    @Test
    void 이분이_지나면_끝나고_점수가_높은_사람이_이긴다() {
        AppleGame game = new AppleGame(TWO, board());
        assertThat(view(game, 0).deadline()).isNull();
        assertThat(game.tick(1_000)).isTrue();
        assertThat(view(game, 0).deadline()).isEqualTo(1_000 + AppleGame.TIME_LIMIT_MILLIS);
        game.act(1, select(0, 4, 0, 5)); // 영희 3 + 7
        assertThat(game.tick(1_000 + AppleGame.TIME_LIMIT_MILLIS - 1)).isFalse();
        assertThat(game.tick(1_000 + AppleGame.TIME_LIMIT_MILLIS)).isTrue();
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(1);
        assertThat(game.resultText()).isEqualTo("사과게임 영희 승리 (2개)");
        assertThatThrownBy(() -> game.act(0, select(0, 0, 0, 1))).isInstanceOf(BusinessException.class); // 끝난 뒤에는 못 고른다
    }

    @Test
    void 아무도_점수가_없으면_무승부이고_한_명만_남으면_끝난다() {
        AppleGame game = new AppleGame(List.of("가", "나", "다"), new Random(4));
        game.leave(2);
        assertThat(game.isFinished()).isFalse();
        game.leave(1);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).isEmpty();
        assertThat(game.resultText()).isEqualTo("사과게임 무승부");
    }

    @Test
    void 무작위_판은_모두에게_같고_숫자는_1에서_9다() {
        AppleGame game = new AppleGame(TWO, new Random(7));
        assertThat(view(game, 0).myBoard()).isEqualTo(view(game, 1).myBoard());
        assertThat(String.join("", view(game, 0).myBoard())).matches("[1-9]{170}");
    }
}
