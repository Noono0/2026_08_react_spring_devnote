package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class Game2048GameTest {
    /**
     * 왼쪽(또는 오른쪽)으로 밀면 128+128 → 256이 되는 판(목표 256이면 바로 성공).
     * 위로 밀면 오른쪽 아래 2만 올라가고 128 두 개는 그대로 붙어 있다 → 다음에 왼쪽으로 밀면 성공(2번 이동)
     */
    private static int[][] almostTarget() {
        return new int[][] {{128, 128, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 2}};
    }

    /**
     * 더 밀 수 없게 되기 직전의 판. 왼쪽으로 밀면 맨 아래 줄의 32,32만 합쳐져 64가 되고(점수 64) 오른쪽 아래 빈칸에 새 타일이 생긴다.
     * 새 타일(2 또는 4)의 이웃은 64와 8이라 더 합칠 수 없다 → 실패
     */
    private static int[][] almostStuck() {
        return new int[][] {
            {2, 4, 2, 4},
            {4, 2, 4, 2},
            {2, 4, 2, 8},
            {8, 16, 32, 32},
        };
    }

    private static GameAction move(String direction) {
        return new GameAction("MOVE", direction, null, null);
    }

    private static Game2048Game.View view(Game2048Game game, Integer seat) {
        return (Game2048Game.View) game.viewFor(seat);
    }

    @Test
    void 한_줄_밀기는_합친_타일을_다시_합치지_않고_점수는_합친_값의_합이다() {
        Game2048Game.LineResult result = Game2048Game.slideLine(new int[] {2, 2, 2, 2});
        assertThat(result.line()).containsExactly(4, 4, 0, 0);
        assertThat(result.gained()).isEqualTo(8);
        assertThat(Game2048Game.slideLine(new int[] {0, 4, 4, 8}).line()).containsExactly(8, 8, 0, 0);
    }

    @Test
    void 네_방향_모두_미는_쪽으로_모인다() {
        int[][] board = {{0, 0, 0, 0}, {2, 0, 2, 0}, {0, 0, 0, 0}, {0, 0, 0, 4}};
        assertThat(Game2048Game.slide(board, Game2048Game.Direction.RIGHT).board()[1]).containsExactly(0, 0, 0, 4);
        assertThat(Game2048Game.slide(board, Game2048Game.Direction.UP).board()[0]).containsExactly(2, 0, 2, 4);
        assertThat(Game2048Game.slide(board, Game2048Game.Direction.DOWN).board()[3]).containsExactly(2, 0, 2, 4);
        assertThat(Game2048Game.slide(board, Game2048Game.Direction.LEFT).moved()).isTrue();
        assertThat(Game2048Game.slide(new int[][] {{2, 4, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}}, Game2048Game.Direction.LEFT).moved()).isFalse();
    }

    @Test
    void 모두_같은_처음_판에서_시작하고_똑같이_밀면_새_타일도_똑같이_생긴다() {
        Game2048Game game = new Game2048Game(List.of("철수", "영희", "민수"), new Random(42), 512);
        assertThat(view(game, 0).players().get(0).board()).isEqualTo(view(game, 0).players().get(1).board());

        for (String direction : List.of("LEFT", "UP", "RIGHT", "DOWN", "LEFT")) {
            game.act(0, move(direction));
            game.act(1, move(direction));
        }
        game.act(2, move("UP"));
        var players = view(game, null).players();
        assertThat(players.get(0).board()).isEqualTo(players.get(1).board());
        assertThat(players.get(0).score()).isEqualTo(players.get(1).score());
        assertThat(players.get(0).moves()).isEqualTo(players.get(1).moves());
    }

    @Test
    void 판이_그대로인_이동은_이동_수에_들어가지_않고_잘못된_방향은_거절한다() {
        int[][] board = {{2, 4, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}};
        Game2048Game game = new Game2048Game(List.of("철수", "영희"), 512, board, 1L);
        game.act(0, move("LEFT"));
        game.act(0, move("UP"));
        assertThat(view(game, 0).players().get(0).moves()).isZero();

        assertThatThrownBy(() -> game.act(0, move("JUMP")))
            .isInstanceOfSatisfying(BusinessException.class, exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_MOVE_INVALID));
        assertThatThrownBy(() -> game.act(0, new GameAction("FLIP", null, null, null)))
            .isInstanceOfSatisfying(BusinessException.class, exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_MESSAGE_INVALID));
    }

    @Test
    void 목표_타일을_만들면_성공하고_다른_사람이_끝날_때까지_게임은_계속된다() {
        Game2048Game game = new Game2048Game(List.of("철수", "영희"), 256, almostTarget(), 1L);
        game.act(1, move("LEFT"));

        assertThat(game.isFinished()).isFalse();
        assertThat(view(game, 0).players().get(1).status()).isEqualTo("SUCCESS");
        assertThat(view(game, 0).players().get(1).finishOrder()).isEqualTo(1);
        assertThat(game.drainAnnouncements()).containsExactly("영희님이 256 타일을 만들었습니다! (1번 이동)");
        assertThatThrownBy(() -> game.act(1, move("RIGHT")))
            .isInstanceOfSatisfying(BusinessException.class, exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_GAME_NOT_PLAYING));

        game.act(0, move("UP")); // 철수는 아직 목표를 못 만들었다
        assertThat(view(game, 0).players().get(0).moves()).isEqualTo(1);
        assertThat(game.isFinished()).isFalse();
    }

    @Test
    void 이동_수가_적은_성공이_이기고_같으면_먼저_끝낸_사람이_이긴다() {
        Game2048Game game = new Game2048Game(List.of("철수", "영희", "민수"), 256, almostTarget(), 1L);
        game.act(2, move("LEFT")); // 민수: 1번 만에 성공(1등으로 끝냄)
        game.act(0, move("LEFT")); // 철수: 1번 만에 성공(2등으로 끝냄)
        game.act(1, move("UP")); // 영희: 2번 만에 성공
        game.act(1, move("LEFT"));

        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(2);
        assertThat(view(game, null).players()).extracting(Game2048Game.PlayerView::rank).containsExactly(2, 3, 1);
        assertThat(game.resultText()).isEqualTo("2048 대전(목표 256) 1위 민수 1번 만에 성공 · 2위 철수 1번 만에 성공 · 3위 영희 2번 만에 성공");
    }

    @Test
    void 아무도_성공하지_못하면_점수가_높은_실패가_이기고_같은_점수면_공동_승리() {
        Game2048Game game = new Game2048Game(List.of("철수", "영희"), 2048, almostStuck(), 1L);
        game.act(0, move("LEFT"));
        game.act(1, move("LEFT"));

        assertThat(game.isFinished()).isTrue();
        assertThat(view(game, null).players()).extracting(Game2048Game.PlayerView::status).containsExactly("FAILED", "FAILED");
        assertThat(game.winnerSeats()).containsExactly(0, 1);
        assertThat(game.resultText()).isEqualTo("2048 대전(목표 2048) 1위 철수 64점 · 1위 영희 64점");
    }

    @Test
    void 성공한_사람이_빠진_사람보다_위이고_빠진_사람은_이길_수_없다() {
        Game2048Game game = new Game2048Game(List.of("철수", "영희", "민수"), 256, almostTarget(), 1L);
        game.act(0, move("UP"));
        game.leave(0); // 철수: 빠짐
        game.act(1, move("LEFT")); // 영희: 성공
        game.leave(2); // 민수: 빠짐

        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(1);
        assertThat(game.resultText()).isEqualTo("2048 대전(목표 256) 1위 영희 1번 만에 성공 · 2위 철수 빠짐 · 2위 민수 빠짐");
    }

    @Test
    void 다른_사람이_실패로_끝났으면_혼자_남아도_끝까지_하고_모두_빠지면_남은_사람이_바로_이긴다() {
        Game2048Game failedOther = new Game2048Game(List.of("철수", "영희", "민수"), 2048, almostStuck(), 1L);
        failedOther.act(0, move("LEFT")); // 철수 실패
        failedOther.leave(1); // 영희 빠짐
        assertThat(failedOther.isFinished()).isFalse(); // 민수는 철수보다 점수를 더 낼 수 있으므로 계속한다

        Game2048Game allLeft = new Game2048Game(List.of("철수", "영희", "민수"), 512, almostTarget(), 1L);
        allLeft.leave(0);
        allLeft.leave(1);
        assertThat(allLeft.isFinished()).isTrue();
        assertThat(allLeft.winnerSeats()).containsExactly(2);
    }

    @Test
    void 먼저_끝낸_자리는_결과가_정해진_자리다() {
        Game2048Game game = new Game2048Game(List.of("철수", "영희"), 256, almostTarget(), 1L);
        assertThat(game.hasSettledResult(0)).isFalse();
        game.act(0, move("LEFT"));
        assertThat(game.hasSettledResult(0)).isTrue();
        game.leave(0); // 성공한 뒤 나가도 성공 그대로
        assertThat(view(game, null).players().get(0).status()).isEqualTo("SUCCESS");
    }
}
