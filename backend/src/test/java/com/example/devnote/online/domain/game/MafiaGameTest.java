package com.example.devnote.online.domain.game;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.online.domain.game.MafiaGame.Phase;
import com.example.devnote.online.domain.game.MafiaGame.Role;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MafiaGameTest {
    private static final List<String> FIVE = List.of("마피", "경찰", "의사", "시민1", "시민2");

    private static GameAction target(int seat) {
        return new GameAction("TARGET", null, seat, null);
    }

    private static GameAction vote(Integer seat) {
        return new GameAction("VOTE", null, seat, null);
    }

    private static MafiaGame.View view(MafiaGame game, Integer seat) {
        return (MafiaGame.View) game.viewFor(seat);
    }

    private static MafiaGame fivePlayers() {
        return new MafiaGame(FIVE, List.of(Role.MAFIA, Role.POLICE, Role.DOCTOR, Role.CITIZEN, Role.CITIZEN));
    }

    @Test
    void 인원에_따라_직업을_나누고_남의_직업은_보내지_않는다() {
        MafiaGame game = new MafiaGame(List.of("가", "나", "다", "라", "마", "바"), new Random(7));
        List<String> roles = java.util.stream.IntStream.range(0, 6).mapToObj(seat -> view(game, seat).myRole()).toList();
        assertThat(roles).filteredOn("MAFIA"::equals).hasSize(2);
        assertThat(roles).containsOnlyOnce("POLICE", "DOCTOR");
        int mafia = roles.indexOf("MAFIA");
        int citizen = roles.indexOf("CITIZEN");
        assertThat(view(game, mafia).players()).filteredOn(player -> "MAFIA".equals(player.role())).hasSize(2); // 마피아끼리는 안다
        assertThat(view(game, citizen).players()).filteredOn(player -> player.role() != null).hasSize(1); // 시민은 자기 것만
        assertThat(view(game, null).players()).allMatch(player -> player.role() == null); // 관전자는 모른다
        assertThat(game.drainAnnouncements()).singleElement().asString().contains("마피아 2명");
    }

    @Test
    void 의사가_살리면_아무도_죽지_않고_경찰은_조사_결과를_혼자_받는다() {
        MafiaGame game = fivePlayers();
        assertThatThrownBy(() -> game.act(3, target(0))).isInstanceOf(BusinessException.class); // 시민은 밤에 할 일이 없다
        assertThatThrownBy(() -> game.act(0, vote(1))).isInstanceOf(BusinessException.class); // 밤에는 투표 불가
        game.act(0, target(3));
        game.act(1, target(0));
        assertThat(view(game, 0).phase()).isEqualTo(Phase.NIGHT); // 의사가 아직
        game.act(2, target(3));
        assertThat(view(game, 0).phase()).isEqualTo(Phase.DAY);
        assertThat(view(game, 3).players()).allMatch(MafiaGame.PlayerView::alive);
        assertThat(view(game, 1).investigations()).containsExactly(new MafiaGame.Investigation(0, true));
        assertThat(view(game, 2).investigations()).isEmpty();
        assertThat(game.drainAnnouncements()).anyMatch(text -> text.contains("아무도 죽지 않았습니다"));
    }

    @Test
    void 낮_투표로_마피아를_처형하면_시민_팀이_이긴다() {
        MafiaGame game = fivePlayers();
        game.act(0, target(4));
        game.act(1, target(2));
        game.act(2, target(1));
        assertThat(view(game, null).players().get(4).alive()).isFalse();
        game.act(0, vote(1));
        game.act(1, vote(0));
        assertThat(view(game, null).players().get(1).done()).isTrue(); // 누가 투표했는지는 보인다
        game.act(2, vote(0));
        game.act(3, vote(0));
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).isEqualTo("마피아 시민 팀 승리");
        assertThat(view(game, 3).players().get(0).role()).isEqualTo("MAFIA"); // 끝나면 모두 공개
    }

    @Test
    void 동점이면_처형하지_않고_마피아가_나머지_수와_같아지면_마피아_팀이_이긴다() {
        MafiaGame game = new MafiaGame(List.of("마피", "경찰", "시민1", "시민2"), List.of(Role.MAFIA, Role.POLICE, Role.CITIZEN, Role.CITIZEN));
        game.act(1, target(2));
        game.act(0, target(2));
        assertThat(game.canChat(2)).isFalse(); // 탈락하면 채팅 금지
        assertThat(game.canChat(3)).isTrue();
        assertThatThrownBy(() -> game.act(2, vote(0))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> game.act(0, vote(0))).isInstanceOf(BusinessException.class); // 나에게는 투표 불가
        game.act(0, vote(1));
        game.act(1, vote(0));
        game.act(3, vote(null)); // 건너뛰기
        assertThat(view(game, null).phase()).isEqualTo(Phase.NIGHT);
        assertThat(view(game, null).round()).isEqualTo(2);
        game.act(0, target(1));
        game.act(1, target(3));
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).isEqualTo("마피아 마피아 팀 승리");
        assertThat(game.canChat(2)).isTrue();
    }

    @Test
    void 마피아가_나가면_시민_팀_승리_투표_중_나가면_그_사람에게_간_표는_다시_고른다() {
        MafiaGame game = fivePlayers();
        game.act(0, target(4));
        game.act(1, target(3));
        game.act(2, target(2));
        game.act(1, vote(3));
        game.act(2, vote(3));
        game.leave(3);
        assertThat(view(game, 1).myChoice()).isNull();
        assertThat(game.isFinished()).isFalse();
        game.leave(0);
        assertThat(game.isFinished()).isTrue();
        assertThat(game.resultText()).isEqualTo("마피아 시민 팀 승리");
    }
}
