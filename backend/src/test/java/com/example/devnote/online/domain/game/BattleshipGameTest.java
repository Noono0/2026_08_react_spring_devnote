package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BattleshipGameTest {
    private static GameAction action(String name) {
        return new GameAction(name, null, null, null);
    }

    private static GameAction fire(int row, int col) {
        return new GameAction("FIRE", null, null, List.of(row, col));
    }

    private static BattleshipGame.View view(BattleshipGame game, Integer seat) {
        return (BattleshipGame.View) game.viewFor(seat);
    }

    /** 배를 0번 줄부터 차례로 가로로 놓은 단순한 배치(줄 i에 i번째 배) */
    private static List<List<BattleshipGame.Cell>> rowFleet() {
        List<List<BattleshipGame.Cell>> fleet = new ArrayList<>();
        for (int index = 0; index < BattleshipGame.SHIP_LENGTHS.size(); index++) {
            List<BattleshipGame.Cell> ship = new ArrayList<>();
            for (int col = 0; col < BattleshipGame.SHIP_LENGTHS.get(index); col++) ship.add(new BattleshipGame.Cell(index, col));
            fleet.add(ship);
        }
        return fleet;
    }

    private static BattleshipGame readyGame() {
        BattleshipGame game = new BattleshipGame(List.of("철수", "영희"), new Random(1));
        game.setFleet(0, rowFleet());
        game.setFleet(1, rowFleet());
        game.act(0, action("READY"));
        game.act(1, action("READY"));
        return game;
    }

    @Test
    void 무작위_배치는_배_5척이_겹치지_않고_판_안에_있다() {
        BattleshipGame game = new BattleshipGame(List.of("철수", "영희"), new Random(7));
        for (int trial = 0; trial < 50; trial++) {
            var fleet = game.randomFleet();
            assertThat(fleet).extracting(List::size).containsExactly(5, 4, 3, 3, 2);
            var cells = fleet.stream().flatMap(List::stream).toList();
            assertThat(cells).doesNotHaveDuplicates();
            assertThat(cells).allMatch(cell -> cell.row() >= 0 && cell.row() < 10 && cell.col() >= 0 && cell.col() < 10);
        }
    }

    @Test
    void 내_배는_나에게만_보이고_상대와_관전자에게는_숨긴다() {
        BattleshipGame game = new BattleshipGame(List.of("철수", "영희"), new Random(3));
        long myShipCells = view(game, 0).boards().get(0).rows().stream().mapToLong(row -> row.chars().filter(c -> c == 'S').count()).sum();
        assertThat(myShipCells).isEqualTo(17);
        assertThat(String.join("", view(game, 1).boards().get(0).rows())).doesNotContain("S");
        assertThat(String.join("", view(game, null).boards().get(0).rows())).doesNotContain("S");
    }

    @Test
    void 준비_완료_뒤에는_다시_배치할_수_없고_둘_다_준비되면_0번부터_쏜다() {
        BattleshipGame game = new BattleshipGame(List.of("철수", "영희"), new Random(3));
        game.act(0, action("RANDOMIZE"));
        game.act(0, action("READY"));
        assertThatThrownBy(() -> game.act(0, action("RANDOMIZE"))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, fire(0, 0))).isInstanceOf(BusinessException.class); // 영희가 아직 준비 중
        game.act(1, action("READY"));
        assertThat(view(game, 0).phase()).isEqualTo("PLAY");
        assertThat(view(game, 0).turnSeat()).isZero();
    }

    @Test
    void 번갈아_쏘고_같은_칸은_다시_쏠_수_없다() {
        BattleshipGame game = readyGame();
        game.act(0, fire(9, 9)); // 빗나감
        assertThat(view(game, 0).boards().get(1).rows().get(9)).isEqualTo(".........o");
        assertThatThrownBy(() -> game.act(0, fire(5, 5))).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_NOT_YOUR_TURN));
        game.act(1, fire(0, 0)); // 명중
        assertThat(view(game, 0).boards().get(0).rows().get(0)).startsWith("XSSSS");
        assertThat(view(game, 1).boards().get(0).rows().get(0)).isEqualTo("X.........");
        assertThatThrownBy(() -> game.act(0, fire(9, 9))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, fire(10, 0))).isInstanceOf(BusinessException.class);
    }

    @Test
    void 격침된_배는_모두에게_보이고_모두_격침하면_이긴다() {
        BattleshipGame game = readyGame();
        int enemyMisses = 0;
        // 철수가 영희 배를 차례로 모두 쏘고, 영희는 빈 바다(9번 줄)만 쏜다
        for (int index = 0; index < 5; index++) {
            for (int col = 0; col < BattleshipGame.SHIP_LENGTHS.get(index); col++) {
                game.act(0, fire(index, col));
                if (game.isFinished()) break;
                game.act(1, fire(9 - enemyMisses / 10, enemyMisses % 10)); // 9·8번 줄 빈 바다
                enemyMisses++;
            }
        }
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).isEqualTo("배틀십 철수 승리 (33발)"); // 철수 17발 + 영희 16발
        assertThat(view(game, null).boards().get(1).rows().get(0)).isEqualTo("#####.....");
        assertThat(String.join("", view(game, null).boards().get(0).rows())).contains("S"); // 끝나면 철수 배도 공개
    }

    @Test
    void 기권하면_상대가_이긴다() {
        BattleshipGame game = readyGame();
        game.leave(0);
        assertThat(game.resultText()).startsWith("배틀십 영희 승리");
    }
}
