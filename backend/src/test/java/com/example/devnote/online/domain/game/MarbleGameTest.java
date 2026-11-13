package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Random;
import static org.assertj.core.api.Assertions.*;

class MarbleGameTest {
    private GameAction action(String name) { return new GameAction(name,null,null,null); }
    private MarbleGame.View view(MarbleGame game) { return (MarbleGame.View)game.viewFor(0); }
    private Random twos() { return new Random(0) { @Override public int nextInt(int bound) { return 0; } @Override public boolean nextBoolean() { return true; } }; }

    @Test void rejectsWrongTurnAndDuplicateRollAndKeepsClientMoneyOutOfTheProtocol() {
        var game=new MarbleGame(List.of("가","나"),twos());
        assertError(ErrorCode.ONLINE_NOT_YOUR_TURN,()->game.act(1,action("ROLL")));
        assertError(ErrorCode.ONLINE_MOVE_INVALID,()->game.act(0,action("BUY")));
        var before=view(game);
        game.act(0,new GameAction("ROLL",null,12,List.of(6,6)));
        assertThat(view(game).dice()).containsExactly(1,1);
        assertThat(view(game).players().getFirst().position()).isEqualTo(2);
        assertThat(before.players().getFirst().position()).isZero();
        assertError(ErrorCode.ONLINE_MOVE_INVALID,()->game.act(0,action("ROLL")));
        game.act(0,action("BUY"));
        assertThat(view(game).players().getFirst().cash()).isEqualTo(130);
        assertThat(view(game).properties().get(2).owner()).isZero();
        game.act(0,action("END")); game.act(1,action("ROLL"));
        assertThat(view(game).players().get(1).cash()).isEqualTo(144);
        assertThat(view(game).players().getFirst().cash()).isEqualTo(136);
        assertError(ErrorCode.ONLINE_MOVE_INVALID,()->game.act(1,new GameAction("SELL",null,2,null)));
    }

    @Test void developsOnlyOnRevisitAndSellsForHalfTheInvestment() {
        var game=new MarbleGame(List.of("가","나"),twos());
        game.act(0,action("ROLL")); game.act(0,action("BUY")); game.act(0,action("END"));
        for(int step=0;step<50;step++) {
            var state=view(game);
            if(state.turn()==0 && state.players().getFirst().position()==2 && state.phase().equals("DECIDE")) break;
            game.act(state.turn(),action(state.phase().equals("ROLL")?"ROLL":"END"));
        }
        assertThat(view(game).phase()).isEqualTo("DECIDE");
        int cash=view(game).players().getFirst().cash();
        game.act(0,action("UPGRADE"));
        assertThat(view(game).properties().get(2).level()).isEqualTo(1);
        assertThat(view(game).players().getFirst().cash()).isEqualTo(cash-10);
        game.act(0,new GameAction("SELL",null,2,null));
        assertThat(view(game).properties().get(2).owner()).isNull();
        assertThat(view(game).players().getFirst().cash()).isEqualTo(cash+5);
    }

    @Test void timeoutAdvancesWithoutWaitingForAnIdlePlayerAndForfeitKeepsTheRemainingWinner() {
        var game=new MarbleGame(List.of("가","나","다"),twos());
        assertThat(game.tick(1000)).isTrue();
        assertThat(game.tick(60_999)).isFalse();
        assertThat(game.tick(61_000)).isTrue();
        assertThat(view(game).turn()).isEqualTo(1);
        assertThat(view(game).phase()).isEqualTo("ROLL");
        game.leave(1); assertThat(view(game).turn()).isEqualTo(2);
        game.leave(0); assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(2);
        assertError(ErrorCode.ONLINE_GAME_NOT_PLAYING,()->game.act(2,action("ROLL")));
    }

    @Test void seededMatchesFinishWithValidOwnershipAndNonnegativeCash() {
        for(int seed=0;seed<30;seed++) {
            var game=new MarbleGame(List.of("가","나","다","라"),new Random(seed));
            for(int step=0;step<600 && !game.isFinished();step++) {
                var state=view(game); var player=state.players().get(state.turn()); String command="END";
                if(state.phase().equals("ROLL")) command="ROLL";
                else if(state.phase().equals("DECIDE")) {
                    var property=state.properties().get(player.position()); var tile=MarbleGame.TILES.get(player.position());
                    if(property.owner()==null && player.cash()>=tile.price()+25) command="BUY";
                    else if(property.owner()!=null && property.owner()==state.turn() && player.cash()>=tile.price()/2+40) command="UPGRADE";
                }
                game.act(state.turn(),action(command));
                var next=view(game);
                assertThat(next.players()).allMatch(value->value.cash()>=0);
                assertThat(next.properties()).allMatch(value->value.owner()==null || !next.players().get(value.owner()).bankrupt());
            }
            assertThat(game.isFinished()).isTrue(); assertThat(game.winnerSeats()).isNotEmpty();
        }
    }
    private void assertError(ErrorCode error,Runnable action) { assertThatThrownBy(action::run).isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(error); }
}
