package com.example.devnote.online.domain;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TetrisBattleTest {
    private static final String EMPTY_BOARD = ".".repeat(200);
    private static final long NOW = 1_000L;

    @Test
    void 지운_줄_수에_따라_방해_줄_수가_정해진다() {
        assertThat(TetrisBattle.garbageFor(1)).isZero();
        assertThat(TetrisBattle.garbageFor(2)).isEqualTo(1);
        assertThat(TetrisBattle.garbageFor(3)).isEqualTo(2);
        assertThat(TetrisBattle.garbageFor(4)).isEqualTo(4);
        assertThat(TetrisBattle.garbageFor(9)).isZero();
    }

    @Test
    void 공격은_내_다음_자리부터_살아_있는_사람에게_간다() {
        TetrisBattle battle = new TetrisBattle(7, List.of("A", "B", "C", "D"));
        assertThat(battle.attackTarget(0).getAsInt()).isEqualTo(1);
        assertThat(battle.attackTarget(3).getAsInt()).isZero(); // 마지막 자리 다음은 처음 자리
        battle.eliminate(1);
        assertThat(battle.attackTarget(0).getAsInt()).isEqualTo(2); // 탈락한 B는 건너뛴다
    }

    @Test
    void 탈락한_순서의_반대로_등수가_매겨지고_한_명_남으면_1위로_끝난다() {
        TetrisBattle battle = new TetrisBattle(7, List.of("A", "B", "C"));
        battle.eliminate(2);
        assertThat(battle.rankOf(2)).isEqualTo(3);
        assertThat(battle.isFinished()).isFalse();
        battle.eliminate(0);
        assertThat(battle.isFinished()).isTrue();
        assertThat(battle.getWinnerSeat()).isEqualTo(1);
        assertThat(battle.describeResult()).isEqualTo("1위 B · 2위 A · 3위 C");
        battle.eliminate(1); // 끝난 뒤에는 아무 변화 없음
        assertThat(battle.rankOf(1)).isEqualTo(1);
    }

    @Test
    void 판_요약은_200글자의_정해진_글자만_받고_탈락한_사람은_보낼_수_없다() {
        TetrisBattle battle = new TetrisBattle(7, List.of("A", "B"));
        battle.updateBoard(0, "G".repeat(10) + ".".repeat(190), 300, 2);
        assertThat(battle.boardOf(0)).startsWith("GGGGGGGGGG");
        assertThat(battle.scoreOf(0)).isEqualTo(300);
        assertThatThrownBy(() -> battle.updateBoard(0, "<script>", 0, 0)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> battle.updateBoard(0, EMPTY_BOARD, -1, 0)).isInstanceOf(BusinessException.class);
        battle.eliminate(1);
        assertThatThrownBy(() -> battle.updateBoard(1, EMPTY_BOARD, 0, 0)).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_GAME_NOT_PLAYING));
    }

    @Test
    void 방에서_테트리스_대전을_시작하면_모두에게_같은_시드를_주고_공격_대상을_정한다() {
        OnlineRoom room = new OnlineRoom("room1", new OnlineRoomSettings("테트리스", OnlineGameType.TETRIS, 3, null, false, false, null), "token", NOW);
        for (String id : List.of("A", "B", "C", "D")) room.addParticipant(new OnlineParticipant(id, "s" + id, "닉" + id, null), false, NOW);
        room.sit("A", 0);
        room.sit("B", 1);
        room.sit("C", 2);
        room.start("A", NOW, 12345);
        assertThat(room.getTetrisBattle().getSeed()).isEqualTo(12345);
        assertThat(room.getTetrisBattle().getPlayerCount()).isEqualTo(3);

        assertThat(room.tetrisAttack("A", 1)).isNull(); // 1줄은 공격 없음
        assertThat(room.tetrisAttack("A", 4)).isEqualTo(new OnlineRoom.TetrisAttack("B", 4));
        assertThatThrownBy(() -> room.tetrisAttack("D", 4)).isInstanceOf(BusinessException.class); // 관전자

        room.tetrisToppedOut("B", NOW);
        assertThat(room.tetrisAttack("A", 2)).isEqualTo(new OnlineRoom.TetrisAttack("C", 1));
        room.removeParticipant("C", NOW); // 게임 중에 나가면 탈락 → A 혼자 남아 1위
        assertThat(room.getStatus()).isEqualTo(OnlineRoom.Status.WAITING);
        assertThat(room.getLastResult()).isEqualTo("1위 닉A · 2위 닉C · 3위 닉B");
    }

    @Test
    void 테트리스_기권은_나만_탈락하고_게임은_계속된다() {
        OnlineRoom room = new OnlineRoom("room1", new OnlineRoomSettings("테트리스", OnlineGameType.TETRIS, 3, null, false, false, null), "token", NOW);
        for (String id : List.of("A", "B", "C")) room.addParticipant(new OnlineParticipant(id, "s" + id, "닉" + id, null), false, NOW);
        room.sit("A", 0);
        room.sit("B", 1);
        room.sit("C", 2);
        room.start("A", NOW, 1);
        room.resign("C", NOW);
        assertThat(room.getStatus()).isEqualTo(OnlineRoom.Status.PLAYING);
        assertThat(room.getTetrisBattle().isAlive(2)).isFalse();
    }
}
