package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.online.domain.game.CatchMindGame.Phase;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CatchMindGameTest {
    private static final List<String> THREE = List.of("철수", "영희", "민수");
    private static final List<String> WORDS = List.of("사과", "아이스크림", "고양이", "기차", "별", "달");

    private static GameAction draw(Integer... numbers) {
        return new GameAction("DRAW", null, null, List.of(numbers));
    }

    private static GameAction guess(String text) {
        return new GameAction("GUESS", text, null, null);
    }

    private static GameAction simple(String action) {
        return new GameAction(action, null, null, null);
    }

    private static CatchMindGame.View view(CatchMindGame game, Integer seat) {
        return (CatchMindGame.View) game.viewFor(seat);
    }

    @Test
    void 제시어는_출제자에게만_보내고_출제자는_채팅할_수_없다() {
        CatchMindGame game = new CatchMindGame(THREE, WORDS, 1);
        assertThat(view(game, 0).word()).isEqualTo("사과");
        assertThat(view(game, 1).word()).isNull();
        assertThat(view(game, null).word()).isNull();
        assertThat(view(game, 1).wordLength()).isEqualTo(2); // 글자 수 힌트는 모두에게
        assertThat(game.canChat(0)).isFalse();
        assertThat(game.canChat(1)).isTrue();
    }

    @Test
    void 출제자만_그리고_지울_수_있으며_좌표와_색을_검사한다() {
        CatchMindGame game = new CatchMindGame(THREE, WORDS, 1);
        game.act(0, draw(1, 6, 100, 100, 200, 150));
        game.act(0, draw(2, 6, 300, 300));
        assertThat(view(game, 2).strokes()).hasSize(2);
        assertThat(view(game, 2).strokes().get(0).points()).containsExactly(100, 100, 200, 150);

        assertThatThrownBy(() -> game.act(1, draw(1, 6, 10, 10))).isInstanceOf(BusinessException.class); // 출제자가 아니다
        assertThatThrownBy(() -> game.act(0, draw(1, 6, 1001, 10))).isInstanceOf(BusinessException.class); // 그림판 밖
        assertThatThrownBy(() -> game.act(0, draw(9, 6, 10, 10))).isInstanceOf(BusinessException.class); // 없는 색
        assertThatThrownBy(() -> game.act(0, draw(1, 6, 10))).isInstanceOf(BusinessException.class); // 짝이 안 맞는 좌표

        game.act(0, simple("UNDO"));
        assertThat(view(game, 1).strokes()).hasSize(1);
        game.act(0, simple("CLEAR"));
        assertThat(view(game, 1).strokes()).isEmpty();
    }

    @Test
    void 그림_전체_크기를_제한한다() {
        CatchMindGame game = new CatchMindGame(THREE, WORDS, 1);
        List<Integer> stroke = new ArrayList<>(List.of(0, 4));
        for (int index = 0; index < (CatchMindGame.MAX_NUMBERS_PER_STROKE - 2) / 2; index++) stroke.addAll(List.of(500, 300));
        GameAction big = new GameAction("DRAW", null, null, stroke);
        int allowed = CatchMindGame.MAX_POINT_NUMBERS_PER_DRAWING / (stroke.size() - 2);
        for (int count = 0; count < allowed; count++) game.act(0, big);
        assertThatThrownBy(() -> game.act(0, big)).isInstanceOf(BusinessException.class);
        game.act(0, simple("UNDO")); // 하나 지우면 다시 그릴 수 있다
        game.act(0, big);
    }

    @Test
    void 정답은_띄어쓰기를_무시하고_맞힌_사람과_출제자가_점수를_얻는다() {
        CatchMindGame game = new CatchMindGame(THREE, WORDS, 1);
        assertThatThrownBy(() -> game.act(0, guess("사과"))).isInstanceOf(BusinessException.class); // 출제자는 답을 못 낸다
        game.act(1, guess("배"));
        assertThat(view(game, 2).guesses()).containsExactly("영희: 배");
        game.act(0, draw(0, 4, 10, 10));
        game.act(2, guess(" 사 과 "));
        CatchMindGame.View next = view(game, 1);
        assertThat(next.scores()).containsExactly(5, 0, 10);
        assertThat(next.drawerSeat()).isEqualTo(1);
        assertThat(next.word()).isEqualTo("아이스크림");
        assertThat(next.strokes()).isEmpty(); // 새 그림은 빈 판에서
        assertThat(next.guesses()).isEmpty();
        assertThat(game.drainAnnouncements()).anyMatch(text -> text.contains("민수 님 정답") && text.contains("'사과'"));
    }

    @Test
    void 모든_차례가_끝나면_최고_점수가_이긴다() {
        CatchMindGame game = new CatchMindGame(THREE, WORDS, 1);
        game.act(1, guess("사과")); // 영희 10, 철수 5
        game.act(1, simple("PASS")); // 영희 차례 넘기기
        game.act(1, guess("고양이")); // 민수 차례: 영희 10 더, 민수 5
        assertThat(game.isFinished()).isTrue();
        assertThat(view(game, null).phase()).isEqualTo(Phase.END);
        assertThat(view(game, 2).word()).isNull(); // 끝난 뒤에는 출제자에게도 제시어를 보내지 않는다(이미 채팅으로 공개)
        assertThat(game.winnerSeats()).containsExactly(1);
        assertThat(game.resultText()).isEqualTo("캐치마인드 영희 승리");
    }

    @Test
    void 출제자가_나가면_다음_차례로_넘어가고_한_명만_남으면_끝난다() {
        CatchMindGame game = new CatchMindGame(THREE, WORDS, 2);
        game.leave(0);
        assertThat(view(game, null).drawerSeat()).isEqualTo(1);
        assertThat(game.drainAnnouncements()).anyMatch(text -> text.contains("정답은 '사과'"));
        game.leave(2);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.winnerSeats()).isEmpty(); // 아무도 점수가 없으면 무승부
    }

    @Test
    void 섞은_제시어로_시작한다() {
        CatchMindGame game = new CatchMindGame(List.of("가", "나"), new Random(1), 3);
        assertThat(view(game, 0).totalTurns()).isEqualTo(6);
        assertThat(CatchMindGame.WORDS).contains(view(game, 0).word());
    }
}
