package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.online.domain.game.YutnoriGame.MoveOption;
import com.example.devnote.online.domain.game.YutnoriGame.Phase;
import com.example.devnote.online.domain.game.YutnoriGame.Throw;
import org.junit.jupiter.api.Test;

import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class YutnoriGameTest {
    private static final List<String> TWO = List.of("철수", "영희");
    private static final GameAction THROW = new GameAction("THROW", null, null, null);

    private static GameAction move(int piece, int throwIndex) {
        return new GameAction("MOVE", null, null, List.of(piece, throwIndex));
    }

    /** 윷 결과를 정해 둔 순서대로 내놓는 게임 */
    private static YutnoriGame game(int pieceCount, Throw... throwsInOrder) {
        Deque<Throw> queue = new ArrayDeque<>(Arrays.asList(throwsInOrder));
        return new YutnoriGame(TWO, pieceCount, queue::removeFirst);
    }

    private static YutnoriGame.View view(YutnoriGame game, Integer seat) {
        return (YutnoriGame.View) game.viewFor(seat);
    }

    @Test
    void 바깥길과_지름길_도착_칸을_계산한다() {
        assertThat(YutnoriGame.destination(0, 5)).isEqualTo(5); // 처음 모 → 첫 모서리
        assertThat(YutnoriGame.destination(5, 3)).isEqualTo(23); // 모서리에 멈췄으면 지름길로 가운데까지
        assertThat(YutnoriGame.destination(23, 3)).isEqualTo(20); // 가운데에서는 출발점 쪽으로
        assertThat(YutnoriGame.destination(10, 2)).isEqualTo(27);
        assertThat(YutnoriGame.destination(25, 1)).isEqualTo(15); // 첫 지름길 끝은 세 번째 모서리
        assertThat(YutnoriGame.destination(4, 3)).isEqualTo(7); // 모서리를 지나가기만 하면 바깥길 그대로
        assertThat(YutnoriGame.destination(18, 2)).isEqualTo(20); // 참먹이에 딱 멈추면 아직 안 났다
        assertThat(YutnoriGame.destination(20, 1)).isEqualTo(YutnoriGame.FINISHED);
        assertThat(YutnoriGame.destination(29, 2)).isEqualTo(YutnoriGame.FINISHED);
    }

    @Test
    void 윷과_모는_한_번_더_던지고_모아_둔_결과를_골라_쓴다() {
        YutnoriGame game = game(4, Throw.YUT, Throw.GAE);
        assertThatThrownBy(() -> game.act(1, THROW)).isInstanceOf(BusinessException.class); // 차례가 아니다
        assertThatThrownBy(() -> game.act(0, move(0, 0))).isInstanceOf(BusinessException.class); // 던지기 전
        game.act(0, THROW);
        assertThat(view(game, 0).phase()).isEqualTo(Phase.THROW); // 윷 → 한 번 더
        game.act(0, THROW);
        YutnoriGame.View afterThrows = view(game, 0);
        assertThat(afterThrows.phase()).isEqualTo(Phase.MOVE);
        assertThat(afterThrows.pendingThrows()).containsExactly("YUT", "GAE");
        // 기다리는 말 4개는 대표 하나만 보여 준다: 결과 2개 × 말 1개
        assertThat(afterThrows.moves()).containsExactly(new MoveOption(0, 0, 4), new MoveOption(0, 1, 2));
        assertThat(view(game, 1).moves()).isEmpty(); // 이동 목록은 차례인 사람에게만

        game.act(0, move(0, 1)); // 개 먼저
        game.act(0, move(0, 0)); // 같은 말에 윷 → 6번 칸
        assertThat(view(game, null).pieces().get(0)).containsExactly(6, 0, 0, 0);
        assertThat(view(game, null).turnSeat()).isEqualTo(1);
    }

    @Test
    void 상대_말을_잡으면_처음으로_돌려보내고_한_번_더_던진다() {
        YutnoriGame game = game(4, Throw.GEOL, Throw.GEOL, Throw.DO);
        game.act(0, THROW);
        game.act(0, move(0, 0)); // 철수 3번 칸
        game.act(1, THROW);
        game.act(1, move(0, 0)); // 영희도 3번 칸 → 잡기
        YutnoriGame.View afterCapture = view(game, 1);
        assertThat(afterCapture.pieces().get(0)).containsOnly(YutnoriGame.WAITING);
        assertThat(afterCapture.turnSeat()).isEqualTo(1);
        assertThat(afterCapture.phase()).isEqualTo(Phase.THROW); // 잡았으니 한 번 더
        assertThat(game.drainAnnouncements()).anyMatch(text -> text.contains("잡았습니다"));
        game.act(1, THROW);
        game.act(1, move(0, 0));
        assertThat(view(game, null).turnSeat()).isZero();
    }

    @Test
    void 같은_칸의_내_말은_업혀서_함께_움직이고_모두_나면_이긴다() {
        YutnoriGame game = game(2, Throw.DO, Throw.DO, Throw.DO, Throw.MO, Throw.MO, Throw.MO, Throw.MO, Throw.GEOL);
        game.act(0, THROW);
        game.act(0, move(0, 0)); // 철수 말0 → 1
        game.act(1, THROW);
        game.act(1, move(0, 0)); // 영희 말0 → 1: 철수 말을 잡는다
        game.act(1, THROW); // 잡아서 한 번 더: 도
        game.act(1, move(1, 0)); // 영희 말1 → 1 (말0과 업힘)
        game.act(0, THROW); // 철수: 모·모·모·모·걸
        game.act(0, THROW);
        game.act(0, THROW);
        game.act(0, THROW);
        game.act(0, THROW);
        assertThat(view(game, 0).pendingThrows()).containsExactly("MO", "MO", "MO", "MO", "GEOL");
        game.act(0, move(0, 0)); // 말0 → 5(모서리)
        game.act(0, move(1, 0)); // 말1 → 5, 업힘
        game.act(0, move(0, 0)); // 업힌 두 말 5 → 25
        assertThat(view(game, null).pieces().get(0)).containsExactly(25, 25);
        game.act(0, move(0, 0)); // 25 → 모 → 19
        game.act(0, move(0, 0)); // 19 → 걸 → 났다
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).containsExactly(0);
        assertThat(game.resultText()).isEqualTo("윷놀이 철수 승리");
    }

    @Test
    void 남은_사람이_한_명이면_그_사람이_이긴다() {
        YutnoriGame game = new YutnoriGame(List.of("가", "나", "다"), new Random(3), 4);
        game.leave(0);
        assertThat(view(game, null).turnSeat()).isEqualTo(1); // 차례였던 사람이 나가면 다음 사람
        assertThat(game.isFinished()).isFalse();
        game.leave(2);
        assertThat(game.winnerSeats()).containsExactly(1);
    }
}
