package com.example.devnote.online.domain;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PuyoBattleTest {
    private static final String EMPTY_BOARD = ".".repeat(72);
    private static final long NOW = 1_000L;

    @Test
    void 방해_개수는_1에서_30만_받는다() {
        assertThat(PuyoBattle.garbageFor(0)).isZero();
        assertThat(PuyoBattle.garbageFor(4)).isEqualTo(4);
        assertThat(PuyoBattle.garbageFor(30)).isEqualTo(30);
        assertThat(PuyoBattle.garbageFor(31)).isZero();
    }

    @Test
    void 공격은_내_다음_자리부터_살아_있는_사람에게_간다() {
        PuyoBattle battle = new PuyoBattle(7, List.of("A", "B", "C", "D"));
        assertThat(battle.attackTarget(0).getAsInt()).isEqualTo(1);
        assertThat(battle.attackTarget(3).getAsInt()).isZero();
        battle.eliminate(1);
        assertThat(battle.attackTarget(0).getAsInt()).isEqualTo(2);
    }

    @Test
    void 탈락한_순서의_반대로_등수가_매겨지고_한_명_남으면_1위로_끝난다() {
        PuyoBattle battle = new PuyoBattle(7, List.of("A", "B", "C"));
        battle.eliminate(2);
        assertThat(battle.rankOf(2)).isEqualTo(3);
        assertThat(battle.isFinished()).isFalse();
        battle.eliminate(0);
        assertThat(battle.isFinished()).isTrue();
        assertThat(battle.getWinnerSeat()).isEqualTo(1);
        assertThat(battle.describeResult()).isEqualTo("1위 B · 2위 A · 3위 C");
    }

    @Test
    void 판_요약은_72글자의_정해진_글자만_받고_탈락한_사람은_보낼_수_없다() {
        PuyoBattle battle = new PuyoBattle(7, List.of("A", "B"));
        battle.updateBoard(0, "N".repeat(6) + ".".repeat(66), 300, 2);
        assertThat(battle.boardOf(0)).startsWith("NNNNNN");
        assertThat(battle.scoreOf(0)).isEqualTo(300);
        assertThat(battle.chainsOf(0)).isEqualTo(2);
        assertThatThrownBy(() -> battle.updateBoard(0, "<script>", 0, 0)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> battle.updateBoard(0, EMPTY_BOARD, -1, 0)).isInstanceOf(BusinessException.class);
        battle.eliminate(1);
        assertThatThrownBy(() -> battle.updateBoard(1, EMPTY_BOARD, 0, 0)).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_GAME_NOT_PLAYING));
    }

    @Test
    void 방에서_뿌요뿌요_대전을_시작하면_모두에게_같은_시드를_주고_공격_대상을_정한다() {
        OnlineRoom room = new OnlineRoom("room1", new OnlineRoomSettings("뿌요뿌요", OnlineGameType.PUYO, 3, null, false, false, null), "token", NOW);
        for (String id : List.of("A", "B", "C", "D")) room.addParticipant(new OnlineParticipant(id, "s" + id, "닉" + id, null), false, NOW);
        room.sit("A", 0);
        room.sit("B", 1);
        room.sit("C", 2);
        room.start("A", NOW, 12345);
        assertThat(room.getPuyoBattle().getSeed()).isEqualTo(12345);
        assertThat(room.getPuyoBattle().getPlayerCount()).isEqualTo(3);
        assertThat(room.getGameOption()).isEqualTo("4");

        assertThat(room.puyoAttack("A", 0)).isNull();
        assertThat(room.puyoAttack("A", 4)).isEqualTo(new OnlineRoom.PuyoAttack("B", 4));
        assertThatThrownBy(() -> room.puyoAttack("D", 4)).isInstanceOf(BusinessException.class);

        room.puyoToppedOut("B", NOW);
        assertThat(room.puyoAttack("A", 2)).isEqualTo(new OnlineRoom.PuyoAttack("C", 2));
        room.removeParticipant("C", NOW);
        assertThat(room.getStatus()).isEqualTo(OnlineRoom.Status.WAITING);
        assertThat(room.getLastResult()).isEqualTo("1위 닉A · 2위 닉C · 3위 닉B");
    }

    @Test
    void 뿌요뿌요_기권은_나만_탈락하고_게임은_계속된다() {
        OnlineRoom room = new OnlineRoom("room1", new OnlineRoomSettings("뿌요뿌요", OnlineGameType.PUYO, 3, null, false, false, null), "token", NOW);
        for (String id : List.of("A", "B", "C")) room.addParticipant(new OnlineParticipant(id, "s" + id, "닉" + id, null), false, NOW);
        room.sit("A", 0);
        room.sit("B", 1);
        room.sit("C", 2);
        room.start("A", NOW, 1);
        room.resign("C", NOW);
        assertThat(room.getStatus()).isEqualTo(OnlineRoom.Status.PLAYING);
        assertThat(room.getPuyoBattle().isAlive(2)).isFalse();
    }
}
