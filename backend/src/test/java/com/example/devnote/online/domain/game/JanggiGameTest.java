package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.online.domain.game.JanggiGame.Move;
import com.example.devnote.online.domain.game.JanggiGame.Phase;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JanggiGameTest {
    private static final List<String> TWO = List.of("철수", "영희");
    private static final String EMPTY = ".........";

    private static GameAction arrange(String formation) {
        return new GameAction("ARRANGE", formation, null, null);
    }

    private static GameAction move(int fromRow, int fromCol, int toRow, int toCol) {
        return new GameAction("MOVE", null, null, List.of(fromRow, fromCol, toRow, toCol));
    }

    private static JanggiGame.View view(JanggiGame game, Integer seat) {
        return (JanggiGame.View) game.viewFor(seat);
    }

    /** 위에서부터 0~9줄. 적지 않은 줄은 빈 줄 */
    private static List<String> rows(String... lines) {
        String[] board = new String[10];
        java.util.Arrays.fill(board, EMPTY);
        for (String line : lines) {
            int row = Integer.parseInt(line.substring(0, line.indexOf(':')));
            board[row] = line.substring(line.indexOf(':') + 1);
        }
        return List.of(board);
    }

    private static Set<String> targetsFrom(JanggiGame game, int side, int row, int col) {
        return game.legalMoves(side).stream().filter(move -> move.fromRow() == row && move.fromCol() == col)
            .map(move -> move.toRow() + "," + move.toCol()).collect(Collectors.toSet());
    }

    @Test
    void 두_사람이_상차림을_고르면_판을_차리고_초부터_둔다() {
        JanggiGame game = new JanggiGame(TWO);
        assertThatThrownBy(() -> game.act(0, move(6, 0, 5, 0))).isInstanceOf(BusinessException.class); // 아직 상차림 중
        assertThatThrownBy(() -> game.act(0, arrange("HHEE"))).isInstanceOf(BusinessException.class); // 없는 상차림
        game.act(0, arrange("HEHE"));
        assertThat(view(game, 1).arranged()).containsExactly(true, false);
        assertThat(view(game, 1).myFormation()).isNull();
        game.act(1, arrange("EHHE"));

        JanggiGame.View started = view(game, 0);
        assertThat(started.phase()).isEqualTo(Phase.PLAY);
        assertThat(started.board()).containsExactly(
            "reha.aher", // 한은 위에서 아래를 보므로 고른 "왼쪽"이 판의 오른쪽이다(마마상상이 아니라 상마…마상)
            "....k....",
            ".c.....c.",
            "p.p.p.p.p",
            EMPTY,
            EMPTY,
            "P.P.P.P.P",
            ".C.....C.",
            "....K....",
            "RHEA.AHER");
        assertThat(started.turnSeat()).isZero();
        assertThat(started.moves()).isNotEmpty();
        assertThat(view(game, 1).moves()).isEmpty(); // 둘 수 있는 수는 차례인 사람에게만
        assertThat(started.scores()).containsExactly(144, 147); // 72점 vs 72 + 덤 1.5점(반 점 단위)
    }

    @Test
    void 마는_곧게_가는_첫_칸이_막히면_그쪽으로_못_간다() {
        JanggiGame game = new JanggiGame(TWO);
        game.setBoard(rows("0:....k....", "4:....P....", "5:....H....", "8:....K...."), 0);
        assertThat(targetsFrom(game, 0, 5, 4)).containsExactlyInAnyOrder("7,3", "7,5", "4,2", "6,2", "4,6", "6,6");
    }

    @Test
    void 상은_가는_길의_두_칸이_모두_비어야_한다() {
        JanggiGame game = new JanggiGame(TWO);
        game.setBoard(rows("0:....k....", "5:....E....", "3:...p.....", "8:....K...."), 0);
        // 위로: (4,4) → (3,3)은 막힘 / (3,5) → (2,6) 가능. 아래: (6,4) → (7,3)→(8,2), (7,5)→(8,6)
        Set<String> targets = targetsFrom(game, 0, 5, 4);
        assertThat(targets).contains("2,6", "8,2", "8,6", "3,1", "7,1", "3,7", "7,7");
        assertThat(targets).doesNotContain("2,2");
    }

    @Test
    void 포는_한_기물을_넘어_가고_포를_넘거나_잡을_수_없다() {
        JanggiGame game = new JanggiGame(TWO);
        game.setBoard(rows("0:....k....", "3:.c.......", "6:.P.......", "7:.C.c.....", "8:....K...."), 0);
        // 위: 졸을 넘어 (5,1)(4,1), (3,1)의 한 포는 못 잡음. 오른쪽: 한 포가 첫 기물이라 넘을 수 없음. 아래·왼쪽: 넘을 기물 없음
        assertThat(targetsFrom(game, 0, 7, 1)).containsExactlyInAnyOrder("5,1", "4,1");
    }

    @Test
    void 차는_궁성_안에서_대각선으로도_간다() {
        JanggiGame game = new JanggiGame(TWO);
        game.setBoard(rows("0:....k....", "7:...R.....", "9:....K...."), 0);
        assertThat(targetsFrom(game, 0, 7, 3)).contains("8,4", "9,5");
    }

    @Test
    void 장군이면_쉴_수_없고_궁이_잡히는_수는_둘_수_없다() {
        JanggiGame game = new JanggiGame(TWO);
        game.setBoard(rows("0:...k....R", "2:...a.....", "8:....K...."), 1);
        assertThat(game.isInCheck(1)).isTrue();
        assertThat(view(game, 1).inCheck()).isTrue();
        assertThat(view(game, 1).canPass()).isFalse();
        assertThatThrownBy(() -> game.act(1, new GameAction("PASS", null, null, null))).isInstanceOf(BusinessException.class);
        // 사를 옆으로 옮기는 수는 장군을 못 막으므로 합법수에 없다
        assertThat(game.legalMoves(1)).doesNotContain(new Move(2, 3, 2, 4));
        assertThat(game.legalMoves(1)).allMatch(candidate -> candidate.fromRow() == 0 && candidate.fromCol() == 3);
    }

    @Test
    void 막을_수_없는_장군은_외통이다() {
        JanggiGame game = new JanggiGame(TWO);
        // 1줄의 차가 궁이 피할 (1,3)(1,4)를 막고, 5줄의 차가 0줄로 올라가 장군
        game.setBoard(rows("0:...k.....", "1:.......R.", "5:........R", "8:....K...."), 0);
        game.act(0, move(5, 8, 0, 8));
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(0);
        assertThat(game.resultText()).contains("외통").contains("철수");
    }

    @Test
    void 둘이_연달아_쉬면_남은_기물_점수와_덤으로_끝낸다() {
        JanggiGame game = new JanggiGame(TWO);
        game.setBoard(rows("0:....k....", "3:p........", "8:....K....", "9:R........"), 0);
        game.act(0, new GameAction("PASS", null, null, null));
        game.act(1, new GameAction("PASS", null, null, null));
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(0); // 초 차 13점 vs 한 졸 2점 + 덤 1.5점
        assertThat(game.resultText()).contains("초 13.0").contains("한 3.5");
    }

    @Test
    void 빅장을_다음_수에_풀지_않으면_점수로_끝난다() {
        JanggiGame game = new JanggiGame(TWO);
        game.setBoard(rows("1:....k....", "3:p........", "8:...K.....", "9:R........"), 0);
        game.act(0, move(8, 3, 8, 4)); // 초 궁이 한 궁과 같은 줄로 → 빅장
        assertThat(game.kingsFacing()).isTrue();
        assertThat(game.drainAnnouncements()).anyMatch(text -> text.startsWith("빅장!"));
        assertThat(game.isFinished()).isFalse();
        game.act(1, move(3, 0, 4, 0)); // 한이 빅장을 풀지 않음
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).contains("빅장을 풀지 않아").contains("철수 승리"); // 초 13점 vs 한 2 + 1.5점
    }

    @Test
    void 빅장을_풀면_계속_둔다() {
        JanggiGame game = new JanggiGame(TWO);
        game.setBoard(rows("1:....k....", "3:p........", "8:...K.....", "9:R........"), 0);
        game.act(0, move(8, 3, 8, 4));
        game.act(1, move(1, 4, 1, 3)); // 한 궁이 옆으로 비켜 빅장 해제
        assertThat(game.kingsFacing()).isFalse();
        assertThat(game.isFinished()).isFalse();
        game.act(0, move(9, 0, 9, 1));
        assertThat(game.isFinished()).isFalse();
    }

    @Test
    void 같은_국면이_세_번_나오면_점수로_끝난다() {
        JanggiGame game = new JanggiGame(TWO);
        game.setBoard(rows("0:........r", "1:...k.....", "8:....K....", "9:R........"), 0);
        int[][] cycle = {{9, 0, 9, 1}, {0, 8, 0, 7}, {9, 1, 9, 0}, {0, 7, 0, 8}};
        for (int index = 0; index < 8; index++) {
            int[] step = cycle[index % 4];
            game.act(index % 2, move(step[0], step[1], step[2], step[3]));
        }
        assertThat(game.isFinished()).isFalse(); // 같은 국면 두 번까지는 괜찮다
        game.act(0, move(9, 0, 9, 1)); // 세 번째
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).contains("같은 국면이 세 번");
    }

    @Test
    void 나가면_상대가_이긴다() {
        JanggiGame game = new JanggiGame(TWO);
        game.leave(1);
        assertThat(game.winnerSeats()).containsExactly(0);
    }
}
