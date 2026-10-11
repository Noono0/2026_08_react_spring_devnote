package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MinesweeperGameTest {
    /**
     * 9×9, 지뢰 10개: 6열 전체(9개) + 오른쪽 아래 (8,8).
     * (0,0)에서 미리 열면 0~5열(54칸)이 열린다. 남은 안전한 칸은 7·8열의 17칸.
     *   (0,8)을 열면 8열 0~7행·7열 0~7행이 연쇄로 열리고 (8,7) 한 칸만 남는다(주변 지뢰 3).
     */
    private static MinesweeperGame.Layout wallLayout() {
        boolean[][] mines = new boolean[9][9];
        for (int row = 0; row < 9; row++) mines[row][6] = true;
        mines[8][8] = true;
        return new MinesweeperGame.Layout(mines, 0, 0);
    }

    private static MinesweeperGame newGame(String... nicknames) {
        return new MinesweeperGame(List.of(nicknames), MinesweeperGame.Difficulty.BEGINNER, wallLayout());
    }

    private static GameAction action(String name, int row, int col) {
        return new GameAction(name, null, null, List.of(row, col));
    }

    private static MinesweeperGame.View view(MinesweeperGame game, Integer seat) {
        return (MinesweeperGame.View) game.viewFor(seat);
    }

    private static MinesweeperGame.PlayerView player(MinesweeperGame game, int seat) {
        return view(game, null).players().get(seat);
    }

    @Test
    void 같은_시드면_같은_배치이고_미리_열_칸은_주변_지뢰가_0이다() {
        MinesweeperGame.Layout first = MinesweeperGame.createLayout(MinesweeperGame.Difficulty.EXPERT, new Random(5));
        MinesweeperGame.Layout second = MinesweeperGame.createLayout(MinesweeperGame.Difficulty.EXPERT, new Random(5));
        assertThat(Arrays.deepEquals(first.mines(), second.mines())).isTrue();
        assertThat(first.mines()).hasNumberOfRows(16);
        assertThat(first.mines()[0]).hasSize(30);
        assertThat(Arrays.stream(first.mines()).mapToLong(row -> { int count = 0; for (boolean mine : row) if (mine) count++; return count; }).sum()).isEqualTo(99);
        for (int row = first.startRow() - 1; row <= first.startRow() + 1; row++) {
            for (int col = first.startCol() - 1; col <= first.startCol() + 1; col++) {
                if (row >= 0 && row < 16 && col >= 0 && col < 30) assertThat(first.mines()[row][col]).isFalse();
            }
        }
    }

    @Test
    void 시작하면_모든_판에_같은_빈_영역이_미리_열리고_지뢰는_아무에게도_보내지_않는다() {
        MinesweeperGame game = new MinesweeperGame(List.of("철수", "영희", "민수"), new Random(9), MinesweeperGame.Difficulty.INTERMEDIATE);
        var players = view(game, 0).players();
        assertThat(players.get(0).board()).isEqualTo(players.get(1).board()).isEqualTo(players.get(2).board());
        assertThat(players.get(0).revealed()).isPositive();
        for (Integer seat : Arrays.asList(0, 1, null)) {
            view(game, seat).players().forEach(each -> assertThat(String.join("", each.board())).matches("[.F0-8]+"));
        }
        assertThat(view(game, null).safeCells()).isEqualTo(16 * 16 - 40);
    }

    @Test
    void 연쇄로_열고_마지막_칸을_열면_성공하며_클릭_수는_판을_바꾼_열기만_센다() {
        MinesweeperGame game = newGame("철수", "영희");
        assertThat(player(game, 0).revealed()).isEqualTo(54);
        game.act(0, action("REVEAL", 0, 0)); // 이미 열린 칸: 아무 일 없음
        game.act(0, action("FLAG", 8, 8));
        game.act(0, action("FLAG", 8, 8)); // 깃발 빼기
        game.act(0, action("REVEAL", 0, 8));
        assertThat(player(game, 0).revealed()).isEqualTo(70);
        assertThat(player(game, 0).clicks()).isEqualTo(1);
        assertThat(player(game, 1).revealed()).isEqualTo(54); // 영희 판은 그대로

        game.act(0, action("REVEAL", 8, 7));
        assertThat(player(game, 0).status()).isEqualTo("SUCCESS");
        assertThat(player(game, 0).clicks()).isEqualTo(2);
        assertThat(game.isFinished()).isFalse(); // 영희가 아직 하는 중
        assertThat(game.drainAnnouncements()).containsExactly("철수님이 지뢰를 모두 피했습니다! (2번 클릭)");
    }

    @Test
    void 깃발_수가_맞으면_CHORD로_이웃을_열고_틀린_깃발이면_지뢰를_밟는다() {
        MinesweeperGame game = newGame("철수", "영희");
        game.act(0, action("REVEAL", 0, 8));
        game.act(0, action("CHORD", 7, 8)); // 깃발이 없어 아무 일 없음
        assertThat(player(game, 0).clicks()).isEqualTo(1);
        game.act(0, action("FLAG", 8, 8));
        game.act(0, action("CHORD", 7, 8));
        assertThat(player(game, 0).status()).isEqualTo("SUCCESS");
        assertThat(player(game, 0).clicks()).isEqualTo(2);

        game.act(1, action("REVEAL", 0, 8));
        game.act(1, action("FLAG", 8, 7)); // 지뢰가 아닌 칸에 깃발
        game.act(1, action("CHORD", 7, 8)); // (8,8) 지뢰가 열린다
        assertThat(player(game, 1).status()).isEqualTo("FAILED");
        assertThat(game.isFinished()).isTrue();
    }

    @Test
    void 지뢰를_밟으면_판이_멈추고_밟은_칸은_끝난_뒤에만_공개된다() {
        MinesweeperGame game = newGame("철수", "영희");
        game.act(0, action("REVEAL", 0, 6));
        assertThat(player(game, 0).status()).isEqualTo("FAILED");
        assertThatThrownBy(() -> game.act(0, action("REVEAL", 0, 8)))
            .isInstanceOfSatisfying(BusinessException.class, exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_GAME_NOT_PLAYING));
        for (Integer seat : Arrays.asList(0, 1, null)) {
            view(game, seat).players().forEach(each -> assertThat(String.join("", each.board())).matches("[.F0-8]+"));
        }

        game.act(1, action("FLAG", 0, 7)); // 지뢰가 아닌 곳의 깃발
        game.leave(1);
        assertThat(game.isFinished()).isTrue();
        List<String> finishedBoard = player(game, 0).board();
        assertThat(finishedBoard.get(0).charAt(6)).isEqualTo('X');
        assertThat(finishedBoard.get(1).charAt(6)).isEqualTo('*');
        assertThat(player(game, 1).board().get(0).charAt(7)).isEqualTo('W');
    }

    @Test
    void 클릭_수가_적은_성공이_이기고_아무도_성공하지_못하면_많이_연_사람이_이긴다() {
        MinesweeperGame race = newGame("철수", "영희", "민수");
        race.act(1, action("REVEAL", 0, 8));
        race.act(1, action("REVEAL", 8, 7)); // 영희 2번 클릭 성공
        race.act(0, action("REVEAL", 0, 7));
        race.act(0, action("REVEAL", 0, 8));
        race.act(0, action("REVEAL", 8, 7)); // 철수 3번 클릭 성공
        race.act(2, action("REVEAL", 3, 6)); // 민수 실패
        assertThat(race.isFinished()).isTrue();
        assertThat(race.winnerSeats()).containsExactly(1);
        assertThat(race.resultText()).isEqualTo("지뢰 찾기 대전(초급) 1위 영희 2번 클릭으로 성공 · 2위 철수 3번 클릭으로 성공 · 3위 민수 54칸");

        MinesweeperGame allFailed = newGame("철수", "영희", "민수");
        allFailed.act(0, action("REVEAL", 0, 8));
        allFailed.act(0, action("REVEAL", 0, 6)); // 철수 70칸 열고 실패
        allFailed.act(1, action("REVEAL", 1, 6)); // 영희 54칸
        allFailed.act(2, action("REVEAL", 2, 6)); // 민수 54칸
        assertThat(allFailed.winnerSeats()).containsExactly(0);

        MinesweeperGame tie = newGame("철수", "영희");
        tie.act(0, action("REVEAL", 0, 6));
        tie.act(1, action("REVEAL", 5, 6));
        assertThat(tie.winnerSeats()).containsExactly(0, 1);
    }

    @Test
    void 판_밖의_칸과_모르는_행동은_거절한다() {
        MinesweeperGame game = newGame("철수", "영희");
        assertThatThrownBy(() -> game.act(0, action("REVEAL", 9, 0)))
            .isInstanceOfSatisfying(BusinessException.class, exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_MOVE_INVALID));
        assertThatThrownBy(() -> game.act(0, new GameAction("REVEAL", null, null, List.of(1))))
            .isInstanceOfSatisfying(BusinessException.class, exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_MOVE_INVALID));
        assertThatThrownBy(() -> game.act(0, action("MOVE", 0, 0)))
            .isInstanceOfSatisfying(BusinessException.class, exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_MESSAGE_INVALID));
    }
}
