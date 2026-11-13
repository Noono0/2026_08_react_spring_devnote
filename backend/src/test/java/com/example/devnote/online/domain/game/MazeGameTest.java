package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class MazeGameTest {
    @Test void generatedDifficultiesAreConnectedAndTheFirstLegalEscapeWins() {
        for(String difficulty:List.of("EASY","NORMAL","HARD")) for(int seed=0;seed<12;seed++) {
            var game=new MazeGame(List.of("가","나"),new Random(seed),difficulty);
            var initial=(MazeGame.View)game.viewFor(0);
            var observer=(MazeGame.View)game.viewFor(null);
            assertThat(observer.walls()).isEqualTo(initial.walls());
            var moves=path(initial);
            assertThat(moves).isNotEmpty();
            for(String direction:moves) game.act(1,new GameAction("MOVE",direction,null,null));
            assertThat(game.isFinished()).isTrue(); assertThat(game.winnerSeats()).containsExactly(1);
            var finalView=(MazeGame.View)game.viewFor(1);
            assertThat(finalView.positions().get(1)).isEqualTo(initial.exit());
            assertThat(finalView.moves().getFirst()).isZero();
            assertThat(finalView.moves().get(1)).isEqualTo(moves.size());
            assertThatThrownBy(()->game.act(0,new GameAction("MOVE","RIGHT",null,null))).isInstanceOf(BusinessException.class);
        }
    }

    @Test void wallsDoNotCountAsMovesAndTeleportOrInvalidDirectionIsRejected() {
        var game=new MazeGame(List.of("가","나"),new Random(1),"EASY");
        game.act(0,new GameAction("MOVE","UP",null,null));
        assertThat(((MazeGame.View)game.viewFor(0)).moves()).containsExactly(0,0);
        assertThatThrownBy(()->game.act(0,new GameAction("FINISH",null,null,List.of(9,9)))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(()->game.act(0,new GameAction("MOVE","TELEPORT",null,null))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(()->game.act(-1,new GameAction("MOVE","RIGHT",null,null))).isInstanceOf(BusinessException.class);
        assertThat(game.isFinished()).isFalse();
    }

    @Test void timeoutIsADrawAndForfeitLeavesAValidWinner() {
        var game=new MazeGame(List.of("가","나"),new Random(1),"HARD");
        assertThat(game.tick(1000)).isTrue(); assertThat(game.tick(300_999)).isFalse(); assertThat(game.tick(301_000)).isTrue();
        assertThat(game.isFinished()).isTrue(); assertThat(game.winnerSeats()).isEmpty();
        var other=new MazeGame(List.of("가","나","다"),new Random(2),"EASY");
        other.leave(0); assertThat(other.isFinished()).isFalse(); other.leave(2);
        assertThat(other.winnerSeats()).containsExactly(1);
    }

    private List<String> path(MazeGame.View view) {
        record Step(int row,int col,List<String> directions) {}
        var queue=new ArrayList<Step>(); queue.add(new Step(1,1,List.of())); var visited=new HashSet<String>(); visited.add("1:1");
        int[][] offsets={{-1,0},{1,0},{0,-1},{0,1}}; String[] names={"UP","DOWN","LEFT","RIGHT"};
        for(int index=0;index<queue.size();index++) {
            var step=queue.get(index); if(step.row()==view.exit().row() && step.col()==view.exit().col()) return step.directions();
            for(int direction=0;direction<4;direction++) {
                int row=step.row()+offsets[direction][0],col=step.col()+offsets[direction][1];
                if(row<0 || row>=view.size() || col<0 || col>=view.size() || view.walls().get(row).charAt(col)=='1' || !visited.add(row+":"+col)) continue;
                var moves=new ArrayList<>(step.directions()); moves.add(names[direction]); queue.add(new Step(row,col,List.copyOf(moves)));
            }
        }
        return List.of();
    }
}
