package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SudokuGameTest {
    private static final String[] SOLUTION_ROWS = {
        "534678912", "672195348", "198342567", "859761423", "426853791", "713924856", "961537284", "287419635", "345286179",
    };

    /** 정답 판에서 (0,2)=4, (0,3)=6, (8,8)=9 세 칸만 비운 문제 */
    private static SudokuGenerator.Puzzle smallPuzzle() {
        int[][] solution = new int[9][9];
        for (int row = 0; row < 9; row++) for (int col = 0; col < 9; col++) solution[row][col] = SOLUTION_ROWS[row].charAt(col) - '0';
        int[][] givens = SudokuGenerator.copy(solution);
        givens[0][2] = 0;
        givens[0][3] = 0;
        givens[8][8] = 0;
        return new SudokuGenerator.Puzzle(givens, solution);
    }

    private static SudokuGame newGame(String... nicknames) {
        return new SudokuGame(List.of(nicknames), smallPuzzle());
    }

    private static GameAction place(int row, int col, int value) {
        return new GameAction("PLACE", null, value, List.of(row, col));
    }

    private static GameAction clear(int row, int col) {
        return new GameAction("CLEAR", null, null, List.of(row, col));
    }

    private static SudokuGame.View view(SudokuGame game, Integer seat) {
        return (SudokuGame.View) game.viewFor(seat);
    }

    private static void assertMoveInvalid(Runnable action, String message) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class, exception -> {
            assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_MOVE_INVALID);
            assertThat(exception.getMessage()).isEqualTo(message);
        });
    }

    @Test
    void 만든_문제는_목표_숫자_수이고_답이_하나뿐이며_정답과_어긋나지_않는다() {
        SudokuGenerator.Puzzle puzzle = SudokuGenerator.generate(SudokuGame.GIVEN_COUNT, new Random(42));

        assertThat(SudokuGenerator.countFilled(puzzle.givens())).isEqualTo(SudokuGame.GIVEN_COUNT);
        assertThat(SudokuGenerator.countSolutions(puzzle.givens(), 2)).isEqualTo(1);
        for (int row = 0; row < 9; row++) {
            for (int col = 0; col < 9; col++) {
                int answer = puzzle.solution()[row][col];
                assertThat(answer).isBetween(1, 9);
                assertThat(SudokuGenerator.canPlace(puzzle.solution(), row, col, answer)).isTrue();
                int given = puzzle.givens()[row][col];
                if (given != 0) assertThat(given).isEqualTo(answer);
            }
        }
    }

    @Test
    void 같은_시드면_같은_문제가_나온다() {
        SudokuGenerator.Puzzle first = SudokuGenerator.generate(SudokuGame.GIVEN_COUNT, new Random(7));
        SudokuGenerator.Puzzle second = SudokuGenerator.generate(SudokuGame.GIVEN_COUNT, new Random(7));
        assertThat(Arrays.deepEquals(first.givens(), second.givens())).isTrue();
        assertThat(Arrays.deepEquals(first.solution(), second.solution())).isTrue();
    }

    @Test
    void 모두_같은_문제를_받고_내_판은_나에게만_보이며_남에게는_채운_칸_수만_보인다() {
        SudokuGame game = newGame("철수", "영희");
        game.act(0, place(0, 2, 4));

        assertThat(view(game, 0).givens()).isEqualTo(view(game, 1).givens());
        assertThat(view(game, 0).emptyCells()).isEqualTo(3);
        assertThat(view(game, 0).myBoard().get(0)).isEqualTo("534.78912");
        assertThat(view(game, 1).myBoard().get(0)).isEqualTo("53..78912");
        assertThat(view(game, null).myBoard()).isNull(); // 관전자
        assertThat(view(game, 1).players()).containsExactly(new SudokuGame.PlayerView(1, true), new SudokuGame.PlayerView(0, true));
        assertThat(view(game, 1).solution()).isNull(); // 끝나기 전에는 아무에게도 공개하지 않는다
    }

    @Test
    void 고정_숫자와_판_밖_칸과_1에서_9가_아닌_숫자는_넣을_수_없다() {
        SudokuGame game = newGame("철수", "영희");
        assertMoveInvalid(() -> game.act(0, place(0, 0, 1)), "처음부터 놓인 숫자는 바꿀 수 없습니다.");
        assertMoveInvalid(() -> game.act(0, clear(0, 0)), "처음부터 놓인 숫자는 바꿀 수 없습니다.");
        assertMoveInvalid(() -> game.act(0, place(9, 0, 1)), "판 밖의 칸입니다.");
        assertMoveInvalid(() -> game.act(0, new GameAction("PLACE", null, 1, List.of(0))), "판 밖의 칸입니다.");
        assertMoveInvalid(() -> game.act(0, place(0, 2, 0)), "1~9 숫자만 넣을 수 있습니다.");
        assertMoveInvalid(() -> game.act(0, place(0, 2, 10)), "1~9 숫자만 넣을 수 있습니다.");
        assertThatThrownBy(() -> game.act(0, new GameAction("JUMP", null, null, null)))
            .isInstanceOfSatisfying(BusinessException.class, exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_MESSAGE_INVALID));
    }

    @Test
    void 틀린_숫자로_다_채우면_끝나지_않고_지우고_고칠_수_있다() {
        SudokuGame game = newGame("철수", "영희");
        game.act(0, place(0, 2, 6));
        game.act(0, place(0, 3, 4));
        game.act(0, place(8, 8, 9));
        assertThat(game.isFinished()).isFalse();

        game.act(0, clear(0, 2));
        assertThat(view(game, 0).myBoard().get(0)).isEqualTo("53.478912");
        assertThat(view(game, 1).players().get(0).filled()).isEqualTo(2);
    }

    @Test
    void 가장_먼저_정답을_완성한_사람이_이기고_바로_끝나며_정답이_공개된다() {
        SudokuGame game = newGame("철수", "영희");
        game.act(1, place(0, 2, 4));
        game.act(1, place(0, 3, 6));
        game.act(0, place(0, 2, 4));
        game.act(1, place(8, 8, 9));

        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(1);
        assertThat(game.resultText()).isEqualTo("스도쿠 영희 승리 — 가장 먼저 완성");
        assertThat(view(game, null).solution()).containsExactly(SOLUTION_ROWS);
        assertThat(view(game, null).finished()).isTrue();
        assertThat(game.drainAnnouncements()).containsExactly("영희님이 가장 먼저 완성했습니다!");
        assertThatThrownBy(() -> game.act(0, place(0, 3, 6)))
            .isInstanceOfSatisfying(BusinessException.class, exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_GAME_NOT_PLAYING));
    }

    @Test
    void 나가면_빠지고_혼자_남은_사람이_이긴다() {
        SudokuGame game = newGame("철수", "영희", "민수");
        game.leave(0);
        assertThat(game.isFinished()).isFalse();
        assertThat(view(game, null).players().get(0).active()).isFalse();
        assertThatThrownBy(() -> game.act(0, place(0, 2, 4))).isInstanceOf(BusinessException.class);

        game.leave(2);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(1);
        assertThat(game.resultText()).isEqualTo("스도쿠 영희 승리");
        assertThat(game.drainAnnouncements()).containsExactly("철수님이 빠졌습니다.", "민수님이 빠졌습니다.");
    }
}
