package com.example.devnote.online.service;

import com.example.devnote.common.exception.BusinessException;
import com.example.devnote.common.exception.ErrorCode;
import com.example.devnote.member.dao.row.MemberRow;
import com.example.devnote.member.service.AuthenticationService;
import com.example.devnote.online.domain.OnlineGameType;
import com.example.devnote.online.dto.OnlineClientMessage;
import com.example.devnote.online.dto.OnlineRoomCreateRequest;
import com.example.devnote.online.dto.OnlineRoomCreatedResponse;
import com.example.devnote.online.dto.OnlineRoomSettingsMessage;
import com.example.devnote.online.dto.OnlineServerMessage;
import com.example.devnote.online.store.OnlineRoomStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OnlineRoomServiceTest {
    /** 보낸 메시지를 모아 두는 가짜 전송기 */
    private static final class RecordingSender implements OnlineMessageSender {
        record Sent(String sessionId, OnlineServerMessage message) {}
        final List<Sent> sent = new ArrayList<>();
        final List<String> closed = new ArrayList<>();

        @Override
        public void send(String sessionId, OnlineServerMessage message) {
            sent.add(new Sent(sessionId, message));
        }

        @Override
        public void close(String sessionId, String reason) {
            closed.add(sessionId);
        }

        OnlineServerMessage lastRoomStateFor(String sessionId) {
            return sent.stream().filter(item -> item.sessionId().equals(sessionId) && item.message().type().equals("ROOM_STATE"))
                .reduce((first, second) -> second).map(Sent::message).orElseThrow();
        }
    }

    private final OnlineRoomStore roomStore = new OnlineRoomStore();
    private final RecordingSender sender = new RecordingSender();
    private final AuthenticationService authenticationService = mock(AuthenticationService.class);
    private OnlineRoomService service;

    @BeforeEach
    void setUp() {
        service = new OnlineRoomService(roomStore, sender, authenticationService, Clock.fixed(Instant.ofEpochMilli(5_000_000), ZoneOffset.UTC));
    }

    private OnlineRoomCreatedResponse createRoom(String password, boolean membersOnly) {
        return service.createRoom(new OnlineRoomCreateRequest("한 판 해요", OnlineGameType.OMOK, 2, password, membersOnly), new MockHttpServletRequest());
    }

    private static OnlineClientMessage joinMessage(String roomId, String nickname, String password, String hostToken) {
        return new OnlineClientMessage("JOIN", roomId, nickname, password, hostToken, null, null, null, null, null, null, null, null, null);
    }

    private static void assertError(Runnable action, ErrorCode errorCode) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(errorCode));
    }

    @Test
    void 방을_만든_사람은_표로_비밀번호_없이_들어와_방장이_되고_다른_사람은_비밀번호가_필요하다() {
        OnlineRoomCreatedResponse created = createRoom("1234", false);
        OnlineConnection creator = new OnlineConnection("s1", null, null);
        OnlineConnection guest = new OnlineConnection("s2", null, null);
        // 다른 사람이 먼저 들어오려 해도 비밀번호가 필요하다
        assertError(() -> service.join(guest, joinMessage(created.roomId(), "손님", null, null)), ErrorCode.ONLINE_ROOM_PASSWORD_REQUIRED);
        assertError(() -> service.join(guest, joinMessage(created.roomId(), "손님", "0000", null)), ErrorCode.ONLINE_ROOM_PASSWORD_INVALID);
        assertThat(guest.getPasswordFailures()).isEqualTo(1);

        service.join(creator, joinMessage(created.roomId(), "방장", null, created.hostToken()));
        service.join(guest, joinMessage(created.roomId(), "손님", "1234", null));

        var room = sender.lastRoomStateFor("s2").room();
        assertThat(room.participants()).extracting("nickname").containsExactly("방장", "손님");
        assertThat(room.hostId()).isEqualTo(room.participants().get(0).participantId());
        assertThat(room.myParticipantId()).isEqualTo(room.participants().get(1).participantId());
    }

    @Test
    void 로그인_유저만_방은_로그인해야_만들고_비회원은_들어올_수_없다() {
        assertError(() -> createRoom(null, true), ErrorCode.AUTHENTICATION_REQUIRED);
        MemberRow member = new MemberRow();
        member.setMemberId(3L);
        member.setMemberName("회원");
        when(authenticationService.findAuthenticatedMember(any())).thenReturn(member);
        OnlineRoomCreatedResponse created = createRoom(null, true);

        assertError(() -> service.join(new OnlineConnection("guest", null, null), joinMessage(created.roomId(), "손님", null, null)),
            ErrorCode.ONLINE_ROOM_MEMBERS_ONLY);
        service.join(new OnlineConnection("member", 3L, "김회원"), joinMessage(created.roomId(), "아무거나", null, null));
        assertThat(sender.lastRoomStateFor("member").room().participants().get(0).nickname()).isEqualTo("김회원"); // 회원은 회원 이름
    }

    @Test
    void 비회원_닉네임은_2에서_12자이고_방_안에서_겹칠_수_없다() {
        OnlineRoomCreatedResponse created = createRoom(null, false);
        service.join(new OnlineConnection("s1", null, null), joinMessage(created.roomId(), "철수", null, null));
        assertError(() -> service.join(new OnlineConnection("s2", null, null), joinMessage(created.roomId(), "철", null, null)), ErrorCode.ONLINE_NICKNAME_INVALID);
        assertError(() -> service.join(new OnlineConnection("s2", null, null), joinMessage(created.roomId(), "철수", null, null)), ErrorCode.ONLINE_NICKNAME_TAKEN);
        assertError(() -> service.join(new OnlineConnection("s1", null, null), joinMessage(created.roomId(), "영희", null, null)), ErrorCode.ONLINE_MESSAGE_INVALID);
    }

    @Test
    void 두_사람이_앉아_시작하고_오목을_두면_모두에게_같은_판이_간다() {
        OnlineRoomCreatedResponse created = createRoom(null, false);
        OnlineConnection black = new OnlineConnection("s1", null, null);
        OnlineConnection white = new OnlineConnection("s2", null, null);
        OnlineConnection watcher = new OnlineConnection("s3", null, null);
        service.join(black, joinMessage(created.roomId(), "흑돌", null, created.hostToken()));
        service.join(white, joinMessage(created.roomId(), "백돌", null, null));
        service.join(watcher, joinMessage(created.roomId(), "구경꾼", null, null));
        service.sit(black, 0);
        service.sit(white, 1);
        service.start(black);
        service.placeOmok(black, 7, 7);

        var watcherView = sender.lastRoomStateFor("s3").room();
        assertThat(watcherView.status()).isEqualTo("PLAYING");
        assertThat(watcherView.omok().board()[7][7]).isEqualTo(1);
        assertThat(watcherView.omok().turnSeat()).isEqualTo(1);
        assertError(() -> service.placeOmok(watcher, 0, 0), ErrorCode.ONLINE_NOT_YOUR_TURN);
        assertError(() -> service.placeOmok(black, 0, 0), ErrorCode.ONLINE_NOT_YOUR_TURN);
    }

    @Test
    void 방_정보를_바꾸면_새로_들어오는_사람부터_비밀번호가_필요하다() {
        OnlineRoomCreatedResponse created = createRoom(null, false);
        OnlineConnection host = new OnlineConnection("s1", null, null);
        service.join(host, joinMessage(created.roomId(), "방장", null, created.hostToken()));
        service.updateSettings(host, new OnlineRoomSettingsMessage("비밀 방", null, null, "abcd", false, false));

        assertThat(sender.lastRoomStateFor("s1").room().hasPassword()).isTrue();
        assertError(() -> service.join(new OnlineConnection("s2", null, null), joinMessage(created.roomId(), "손님", null, null)),
            ErrorCode.ONLINE_ROOM_PASSWORD_REQUIRED);
        assertThat(service.getRooms().get(0).title()).isEqualTo("비밀 방");
    }

    @Test
    void 테트리스_대전은_같은_시드로_시작하고_방해_줄은_받는_사람에게만_간다() {
        OnlineRoomCreatedResponse created = service.createRoom(new OnlineRoomCreateRequest("테트리스", OnlineGameType.TETRIS, 2, null, false), new MockHttpServletRequest());
        OnlineConnection first = new OnlineConnection("s1", null, null);
        OnlineConnection second = new OnlineConnection("s2", null, null);
        OnlineConnection watcher = new OnlineConnection("s3", null, null);
        service.join(first, joinMessage(created.roomId(), "하나", null, created.hostToken()));
        service.join(second, joinMessage(created.roomId(), "둘둘", null, null));
        service.join(watcher, joinMessage(created.roomId(), "구경", null, null));
        service.sit(first, 0);
        service.sit(second, 1);
        service.start(first);
        var tetris = sender.lastRoomStateFor("s3").room().tetris();
        assertThat(tetris.seed()).isEqualTo(sender.lastRoomStateFor("s1").room().tetris().seed());
        assertThat(tetris.players()).extracting("nickname").containsExactly("하나", "둘둘");

        sender.sent.clear();
        service.tetrisAttack(first, 4);
        assertThat(sender.sent).hasSize(1);
        assertThat(sender.sent.get(0).sessionId()).isEqualTo("s2");
        assertThat(sender.sent.get(0).message().garbage().lines()).isEqualTo(4);
        assertThat(sender.sent.get(0).message().garbage().holeCol()).isBetween(0, 9);
        assertThat(sender.sent.get(0).message().garbage().fromNickname()).isEqualTo("하나");

        service.updateTetrisBoard(second, "G".repeat(40) + ".".repeat(160), 10, 0);
        assertThat(sender.lastRoomStateFor("s3").room().tetris().players().get(1).board()).startsWith("GGGG");
        service.tetrisToppedOut(second);
        var finished = sender.lastRoomStateFor("s3").room();
        assertThat(finished.status()).isEqualTo("WAITING");
        assertThat(finished.lastResult()).isEqualTo("1위 하나 · 2위 둘둘");
    }

    @Test
    void 채팅은_방_사람_모두에게_가고_나가면_방장이_넘어간다() {
        OnlineRoomCreatedResponse created = createRoom(null, false);
        OnlineConnection first = new OnlineConnection("s1", null, null);
        OnlineConnection second = new OnlineConnection("s2", null, null);
        service.join(first, joinMessage(created.roomId(), "먼저", null, null));
        service.join(second, joinMessage(created.roomId(), "나중", null, null));
        sender.sent.clear();

        service.chat(second, "안녕하세요");
        assertThat(sender.sent).extracting(RecordingSender.Sent::sessionId).containsExactlyInAnyOrder("s1", "s2");
        assertThat(sender.sent.get(0).message().chats().get(0).text()).isEqualTo("안녕하세요");

        service.leave("s1");
        var view = sender.lastRoomStateFor("s2").room();
        assertThat(view.hostId()).isEqualTo(view.myParticipantId());
    }

    @Test
    void 들어가지_않은_연결은_방_안의_일을_할_수_없고_없는_방에는_못_들어간다() {
        OnlineConnection stranger = new OnlineConnection("s9", null, null);
        assertError(() -> service.sit(stranger, 0), ErrorCode.ONLINE_ROOM_NOT_JOINED);
        assertError(() -> service.join(stranger, joinMessage("nothere", "손님", null, null)), ErrorCode.ONLINE_ROOM_NOT_FOUND);
    }

    @Test
    void 사람_없는_방은_1분이_지나면_정리된다() {
        createRoom(null, false);
        assertThat(roomStore.removeExpiredEmptyRooms(5_000_000 + OnlineRoomStore.EMPTY_ROOM_GRACE_MILLIS - 1)).isZero();
        assertThat(roomStore.removeExpiredEmptyRooms(5_000_000 + OnlineRoomStore.EMPTY_ROOM_GRACE_MILLIS)).isEqualTo(1);
        assertThat(service.getRooms()).isEmpty();
    }
}
