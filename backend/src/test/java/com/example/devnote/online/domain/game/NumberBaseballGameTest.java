package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NumberBaseballGameTest {
    private static GameAction secret(String value) {
        return new GameAction("SET_SECRET", value, null, null);
    }

    private static GameAction guess(String value) {
        return new GameAction("GUESS", value, null, null);
    }

    private static NumberBaseballGame.View view(NumberBaseballGame game, Integer seat) {
        return (NumberBaseballGame.View) game.viewFor(seat);
    }

    @Test
    void 스트라이크와_볼을_센다() {
        assertThat(NumberBaseballGame.judge("123", "123")).containsExactly(3, 0);
        assertThat(NumberBaseballGame.judge("123", "321")).containsExactly(1, 2);
        assertThat(NumberBaseballGame.judge("123", "456")).containsExactly(0, 0);
        assertThat(NumberBaseballGame.judge("123", "312")).containsExactly(0, 3);
    }

    @Test
    void 비밀_숫자는_서로_다른_숫자_3개여야_하고_본인에게만_보인다() {
        NumberBaseballGame game = new NumberBaseballGame(List.of("철수", "영희"));
        assertThatThrownBy(() -> game.act(0, secret("112"))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, secret("12a"))).isInstanceOf(BusinessException.class);
        game.act(0, secret("382"));
        assertThat(view(game, 0).mySecret()).isEqualTo("382");
        assertThat(view(game, 1).mySecret()).isNull();
        assertThat(view(game, null).mySecret()).isNull(); // 관전자
        assertThat(view(game, 1).secretReady()).containsExactly(true, false);
        assertThat(view(game, 1).secrets()).isNull(); // 끝나기 전에는 아무에게도 공개하지 않는다
    }

    @Test
    void 모두_정하면_자리_순서대로_다음_사람의_숫자를_맞힌다() {
        NumberBaseballGame game = new NumberBaseballGame(List.of("철수", "영희"));
        game.act(0, secret("123"));
        assertThatThrownBy(() -> game.act(0, guess("456"))).isInstanceOf(BusinessException.class); // 아직 준비 중
        game.act(1, secret("456"));
        assertThat(view(game, 0).phase()).isEqualTo("PLAY");
        assertThat(view(game, 0).turnSeat()).isZero();
        assertThat(view(game, 0).targetSeat()).isEqualTo(1);
        assertThatThrownBy(() -> game.act(1, guess("123"))).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ONLINE_NOT_YOUR_TURN));
        game.act(0, guess("465"));
        assertThat(view(game, 1).history()).containsExactly(new NumberBaseballGame.Pitch(1, 0, 1, "465", 1, 2));
        assertThat(view(game, 1).turnSeat()).isEqualTo(1);
    }

    @Test
    void 먼저_맞혀도_그_바퀴는_끝까지_하고_같은_바퀴에_맞힌_사람은_공동_승리() {
        NumberBaseballGame game = new NumberBaseballGame(List.of("철수", "영희", "민수"));
        game.act(0, secret("123"));
        game.act(1, secret("456"));
        game.act(2, secret("789"));
        game.act(0, guess("456")); // 철수가 영희 숫자를 맞힘
        assertThat(game.isFinished()).isFalse(); // 같은 바퀴의 영희·민수 기회가 남았다
        game.act(1, guess("012"));
        game.act(2, guess("123")); // 민수가 철수 숫자를 맞힘
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).isEqualTo("숫자 야구 철수 · 민수 공동 승리 (1바퀴)");
        assertThat(view(game, null).secrets()).containsExactly("123", "456", "789"); // 끝나면 모두 공개
    }

    @Test
    void 나간_사람은_건너뛰고_혼자_남으면_그_사람이_이긴다() {
        NumberBaseballGame game = new NumberBaseballGame(List.of("철수", "영희", "민수"));
        game.act(0, secret("123"));
        game.act(1, secret("456"));
        game.leave(2); // 준비 중에 나가도 남은 둘이 모두 정했으면 시작
        assertThat(view(game, 0).phase()).isEqualTo("PLAY");
        assertThat(view(game, 0).targetSeat()).isEqualTo(1);
        game.act(0, guess("789"));
        assertThat(view(game, 0).targetSeat()).isZero(); // 영희는 (빠진 민수 대신) 철수를 맞힌다
        game.leave(1);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).startsWith("숫자 야구 철수 승리");
    }

    @Test
    void 안내_문구는_한_번만_꺼내진다() {
        NumberBaseballGame game = new NumberBaseballGame(List.of("철수", "영희"));
        game.act(0, secret("123"));
        assertThat(game.drainAnnouncements()).containsExactly("철수님이 숫자를 정했습니다.");
        assertThat(game.drainAnnouncements()).isEmpty();
    }
}
