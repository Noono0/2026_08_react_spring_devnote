package com.example.devnote.online.domain;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.online.domain.game.GameAction;
import com.example.devnote.online.domain.game.MinesweeperGame;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OnlineRoomTest {
    private static final long NOW = 1_000_000L;

    private static OnlineRoom omokRoom() {
        return new OnlineRoom("room1", new OnlineRoomSettings("한 판 해요", OnlineGameType.OMOK, 2, null, false, false, null), "token", NOW);
    }

    private static OnlineParticipant join(OnlineRoom room, String id) {
        OnlineParticipant participant = new OnlineParticipant(id, "session-" + id, "닉" + id, null);
        room.addParticipant(participant, false, NOW);
        return participant;
    }

    private static void assertError(Runnable action, ErrorCode errorCode) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(errorCode));
    }

    @Test
    void 처음_들어온_사람이_방장이고_방장이_나가면_다음으로_먼저_들어온_사람이_방장() {
        OnlineRoom room = omokRoom();
        join(room, "A");
        join(room, "B");
        join(room, "C");
        assertThat(room.getHostId()).isEqualTo("A");
        room.removeParticipant("A", NOW);
        assertThat(room.getHostId()).isEqualTo("B");
    }

    @Test
    void 방을_만든_사람의_표로_들어오면_먼저_온_사람이_있어도_방장이_된다() {
        OnlineRoom room = omokRoom();
        join(room, "A");
        assertThat(room.hostTokenMatches("token")).isTrue();
        room.addParticipant(new OnlineParticipant("CREATOR", "s", "만든이", null), true, NOW);
        assertThat(room.getHostId()).isEqualTo("CREATOR");
        assertThat(room.hostTokenMatches("다른 표")).isFalse();
    }

    @Test
    void 관전자_포함_10명까지만_들어온다() {
        OnlineRoom room = omokRoom();
        for (int index = 0; index < OnlineRoom.MAX_PARTICIPANTS; index++) join(room, "P" + index);
        assertError(() -> join(room, "X"), ErrorCode.ONLINE_ROOM_FULL);
    }

    @Test
    void 빈_자리에만_앉고_다른_자리로_옮기거나_일어나_관전자가_된다() {
        OnlineRoom room = omokRoom();
        join(room, "A");
        join(room, "B");
        room.sit("A", 0);
        assertError(() -> room.sit("B", 0), ErrorCode.ONLINE_SEAT_UNAVAILABLE);
        assertError(() -> room.sit("B", 2), ErrorCode.ONLINE_SEAT_UNAVAILABLE);
        room.sit("A", 1); // 옮기기
        assertThat(room.getSeats()).containsExactly(null, "A");
        room.stand("A");
        assertThat(room.getSeats()).containsExactly(null, null);
    }

    @Test
    void 인원을_줄이면_앞자리_사람이_남고_뒷자리_사람은_빈_앞자리로_옮기거나_관전자가_된다() {
        OnlineRoom room = omokRoom();
        room.resizeSeats(4);
        List<String> ids = List.of("A", "B", "C", "D");
        ids.forEach(id -> join(room, id));
        for (int seat = 0; seat < 4; seat++) room.sit(ids.get(seat), seat);

        room.resizeSeats(2); // 4인(A,B,C,D) → 2인
        assertThat(room.getSeats()).containsExactly("A", "B");
        assertThat(room.seatOf("C")).isEqualTo(-1);

        room.resizeSeats(4); // 다시 늘리면 빈 자리가 생기고 C·D는 관전자 그대로
        assertThat(room.getSeats()).containsExactly("A", "B", null, null);

        room.stand("A");
        room.sit("D", 3); // (_, B, _, D)
        room.resizeSeats(2);
        assertThat(room.getSeats()).containsExactly("D", "B"); // B는 1번 그대로, D는 빈 0번으로
    }

    @Test
    void 방장만_방_정보를_바꾸고_제목과_비밀번호는_바로_바뀐다() {
        OnlineRoom room = omokRoom();
        join(room, "A");
        join(room, "B");
        assertError(() -> room.updateSettings("B", new OnlineRoomSettings("바꿈", OnlineGameType.OMOK, 2, null, false, false, null), NOW),
            ErrorCode.ONLINE_ROOM_HOST_ONLY);

        room.updateSettings("A", new OnlineRoomSettings("  새 제목  ", OnlineGameType.OMOK, 2, "1234", false, false, null), NOW);
        assertThat(room.getTitle()).isEqualTo("새 제목");
        assertThat(room.hasPassword()).isTrue();
        assertThat(room.passwordMatches("1234")).isTrue();
        assertThat(room.passwordMatches("9999")).isFalse();

        room.updateSettings("A", new OnlineRoomSettings("새 제목", OnlineGameType.OMOK, 2, null, false, false, null), NOW);
        assertThat(room.passwordMatches("1234")).isTrue(); // 비워 보내면 그대로
        room.updateSettings("A", new OnlineRoomSettings("새 제목", OnlineGameType.OMOK, 2, null, true, false, null), NOW);
        assertThat(room.hasPassword()).isFalse(); // 해제
    }

    @Test
    void 잘못된_방_정보는_하나도_바뀌지_않는다() {
        OnlineRoom room = omokRoom();
        join(room, "A");
        assertError(() -> room.updateSettings("A", new OnlineRoomSettings("새 제목", OnlineGameType.OMOK, 2, "12", false, false, null), NOW),
            ErrorCode.ONLINE_ROOM_SETTINGS_INVALID); // 비밀번호 4자 미만
        assertThat(room.getTitle()).isEqualTo("한 판 해요");
        assertError(() -> room.updateSettings("A", new OnlineRoomSettings("새 제목", null, 2, null, false, false, null), NOW), // 게임 종류 없음
            ErrorCode.ONLINE_GAME_NOT_AVAILABLE);
        assertError(() -> room.updateSettings("A", new OnlineRoomSettings("새 제목", OnlineGameType.OMOK, 4, null, false, false, null), NOW),
            ErrorCode.ONLINE_SEAT_COUNT_INVALID);
        assertError(() -> room.updateSettings("A", new OnlineRoomSettings(" ", OnlineGameType.OMOK, 2, null, false, false, null), NOW),
            ErrorCode.ONLINE_ROOM_SETTINGS_INVALID);
    }

    @Test
    void 로그인_유저만은_회원인_방장만_켤_수_있다() {
        OnlineRoom room = omokRoom();
        join(room, "A"); // 비회원 방장
        assertError(() -> room.updateSettings("A", new OnlineRoomSettings("제목", OnlineGameType.OMOK, 2, null, false, true, null), NOW),
            ErrorCode.ONLINE_ROOM_SETTINGS_INVALID);
        OnlineRoom memberRoom = omokRoom();
        memberRoom.addParticipant(new OnlineParticipant("M", "s", "회원", 7L), false, NOW);
        memberRoom.updateSettings("M", new OnlineRoomSettings("제목", OnlineGameType.OMOK, 2, null, false, true, null), NOW);
        assertThat(memberRoom.isMembersOnly()).isTrue();
    }

    @Test
    void 자리가_모두_차야_방장이_시작하고_게임_중에는_자리_이동과_게임_변경을_못_한다() {
        OnlineRoom room = omokRoom();
        join(room, "A");
        join(room, "B");
        join(room, "C");
        room.sit("A", 0);
        assertError(() -> room.start("A", NOW, 0), ErrorCode.ONLINE_GAME_NOT_READY);
        room.sit("B", 1);
        assertError(() -> room.start("B", NOW, 0), ErrorCode.ONLINE_ROOM_HOST_ONLY);
        room.start("A", NOW, 0);
        assertThat(room.getStatus()).isEqualTo(OnlineRoom.Status.PLAYING);

        assertError(() -> room.stand("A"), ErrorCode.ONLINE_GAME_IN_PROGRESS);
        assertError(() -> room.sit("C", 0), ErrorCode.ONLINE_GAME_IN_PROGRESS);
        // 제목은 게임 중에도 바뀐다
        room.updateSettings("A", new OnlineRoomSettings("게임 중 제목", OnlineGameType.OMOK, 2, null, false, false, null), NOW);
        assertThat(room.getTitle()).isEqualTo("게임 중 제목");
    }

    @Test
    void 게임_옵션은_비우면_처음_값이고_고를_수_없는_값은_거절한다() {
        OnlineRoom room = new OnlineRoom("r", new OnlineRoomSettings("2048", OnlineGameType.GAME_2048, 2, null, false, false, null), "token", NOW);
        assertThat(room.getGameOption()).isEqualTo("512");
        assertThat(omokRoom().getGameOption()).isNull();
        assertError(() -> new OnlineRoom("r", new OnlineRoomSettings("2048", OnlineGameType.GAME_2048, 2, null, false, false, "EXPERT"), "token", NOW),
            ErrorCode.ONLINE_GAME_OPTION_INVALID);

        join(room, "A");
        room.updateSettings("A", new OnlineRoomSettings("2048", OnlineGameType.GAME_2048, 2, null, false, false, "256"), NOW);
        assertThat(room.getGameOption()).isEqualTo("256");
        room.updateSettings("A", new OnlineRoomSettings("제목만", OnlineGameType.GAME_2048, 2, null, false, false, null), NOW);
        assertThat(room.getGameOption()).isEqualTo("256"); // 비워 보내면 그대로
        assertError(() -> room.updateSettings("A", new OnlineRoomSettings("2048", OnlineGameType.GAME_2048, 2, null, false, false, "4096"), NOW),
            ErrorCode.ONLINE_GAME_OPTION_INVALID);
        assertThat(room.getTitle()).isEqualTo("제목만");
        assertError(() -> room.updateSettings("A", new OnlineRoomSettings("오목", OnlineGameType.OMOK, 2, null, false, false, "256"), NOW),
            ErrorCode.ONLINE_GAME_OPTION_INVALID); // 오목은 옵션이 없다
    }

    @Test
    void 게임을_바꾸면_옵션이_그_게임의_처음_값이_되고_게임_중에는_옵션을_못_바꾼다() {
        OnlineRoom room = new OnlineRoom("r", new OnlineRoomSettings("2048", OnlineGameType.GAME_2048, 2, null, false, false, "1024"), "token", NOW);
        join(room, "A");
        join(room, "B");
        room.updateSettings("A", new OnlineRoomSettings("지뢰", OnlineGameType.MINESWEEPER, 2, null, false, false, null), NOW);
        assertThat(room.getGameOption()).isEqualTo("BEGINNER");
        room.updateSettings("A", new OnlineRoomSettings("지뢰", OnlineGameType.MINESWEEPER, 2, null, false, false, "EXPERT"), NOW);
        assertThat(room.getChatHistory().getLast().text()).isEqualTo("방 정보가 바뀌었습니다: 지뢰 찾기 대전 · 2인 · 고급 · 16×30 · 지뢰 99");

        room.sit("A", 0);
        room.sit("B", 1);
        room.start("A", NOW, 3);
        assertThat(((MinesweeperGame.View) room.getGame().viewFor(0)).rows()).isEqualTo(16);
        assertError(() -> room.updateSettings("A", new OnlineRoomSettings("지뢰", OnlineGameType.MINESWEEPER, 2, null, false, false, "BEGINNER"), NOW),
            ErrorCode.ONLINE_GAME_IN_PROGRESS);
        room.updateSettings("A", new OnlineRoomSettings("게임 중 제목", OnlineGameType.MINESWEEPER, 2, null, false, false, "EXPERT"), NOW);
        assertThat(room.getTitle()).isEqualTo("게임 중 제목"); // 같은 옵션이면 제목은 바뀐다
    }

    @Test
    void 자기_결과가_정해진_뒤에_나가도_그_결과로_이길_수_있다() {
        OnlineRoom room = new OnlineRoom("r", new OnlineRoomSettings("지뢰", OnlineGameType.MINESWEEPER, 3, null, false, false, null), "token", NOW);
        List<String> ids = List.of("A", "B", "C");
        for (int seat = 0; seat < 3; seat++) {
            join(room, ids.get(seat));
            room.sit(ids.get(seat), seat);
        }
        room.start("A", NOW, 11);
        // A가 지뢰를 밟거나 모두 열 때까지 차례로 연다(이미 연 칸은 아무 일 없음)
        for (int index = 0; index < 81 && !room.getGame().hasSettledResult(0); index++) {
            room.gameAction("A", new GameAction("REVEAL", null, null, List.of(index / 9, index % 9)), NOW);
        }
        assertThat(room.getGame().hasSettledResult(0)).isTrue();

        room.removeParticipant("A", NOW);
        room.resign("B", NOW);
        room.removeParticipant("C", NOW);
        assertThat(room.getStatus()).isEqualTo(OnlineRoom.Status.WAITING);
        OnlineMatchResult result = room.drainFinishedMatch();
        assertThat(result.players()).extracting(OnlineMatchResult.Player::won).containsExactly(true, false, false);
    }

    @Test
    void 관전자는_돌을_못_두고_다섯_줄이면_끝나며_결과가_남는다() {
        OnlineRoom room = omokRoom();
        Arrays.asList("A", "B", "C").forEach(id -> join(room, id));
        room.sit("A", 0);
        room.sit("B", 1);
        room.start("A", NOW, 0);
        assertError(() -> room.placeOmok("C", 7, 7, NOW), ErrorCode.ONLINE_NOT_YOUR_TURN);
        for (int col = 0; col < 4; col++) {
            room.placeOmok("A", 7, col, NOW);
            room.placeOmok("B", 8, col, NOW);
        }
        room.placeOmok("A", 7, 4, NOW);
        assertThat(room.getStatus()).isEqualTo(OnlineRoom.Status.WAITING);
        assertThat(room.getLastResult()).isEqualTo("흑 닉A 승리");
        assertThat(room.getOmokGame().getWinnerSeat()).isZero();
    }

    @Test
    void 게임_중에_플레이어가_나가거나_기권하면_상대가_이긴다() {
        OnlineRoom leaving = omokRoom();
        join(leaving, "A");
        join(leaving, "B");
        leaving.sit("A", 0);
        leaving.sit("B", 1);
        leaving.start("A", NOW, 0);
        leaving.removeParticipant("A", NOW);
        assertThat(leaving.getStatus()).isEqualTo(OnlineRoom.Status.WAITING);
        assertThat(leaving.getLastResult()).isEqualTo("닉A님이 나가 백 닉B 승리");

        OnlineRoom resigning = omokRoom();
        join(resigning, "A");
        join(resigning, "B");
        resigning.sit("A", 0);
        resigning.sit("B", 1);
        resigning.start("A", NOW, 0);
        resigning.resign("B", NOW);
        assertThat(resigning.getOmokGame().getWinnerSeat()).isZero();
        assertThat(resigning.getLastResult()).isEqualTo("닉B 기권 · 흑 닉A 승리");
    }

    @Test
    void 채팅은_1초에_2개까지_200자까지이고_최근_50개만_기억한다() {
        OnlineRoom room = omokRoom();
        join(room, "A");
        room.drainPendingChats();
        room.addChat("A", "안녕\n하세요", NOW);
        room.addChat("A", "두 번째", NOW + 10);
        assertError(() -> room.addChat("A", "세 번째", NOW + 20), ErrorCode.ONLINE_TOO_MANY_MESSAGES);
        room.addChat("A", "1초 뒤", NOW + 1_000);
        assertError(() -> room.addChat("A", "   ", NOW + 5_000), ErrorCode.ONLINE_CHAT_INVALID);
        assertError(() -> room.addChat("A", "가".repeat(201), NOW + 5_000), ErrorCode.ONLINE_CHAT_INVALID);

        List<OnlineChatMessage> chats = room.drainPendingChats();
        assertThat(chats).extracting(OnlineChatMessage::text).containsExactly("안녕 하세요", "두 번째", "1초 뒤");
        assertThat(chats.get(0).spectator()).isTrue(); // 자리에 안 앉았으면 관전자 채팅

        for (int index = 0; index < 60; index++) room.addSystemMessage("안내 " + index, NOW);
        assertThat(room.getChatHistory()).hasSize(OnlineRoom.CHAT_HISTORY_SIZE);
        assertThat(room.getChatHistory().getLast().text()).isEqualTo("안내 59");
    }
}
