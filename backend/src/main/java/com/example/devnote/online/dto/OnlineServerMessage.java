package com.example.devnote.online.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 서버 → 화면 WebSocket 메시지(JSON).
 *
 *   ROOM_STATE   : 방 전체 상태(자리·참가자·게임 판). 무언가 바뀔 때마다 방 사람 모두에게 보낸다.
 *   CHAT         : 새 채팅·안내 문구(chats). 들어온 직후에는 지난 대화(최근 50개)를 한 번에 보낸다.
 *   ERROR        : 요청을 처리하지 못한 이유(보낸 사람에게만)
 *   PONG         : PING에 대한 답
 *   TETRIS_GARBAGE : 테트리스 대전에서 상대가 보낸 방해 줄(받는 사람에게만)
 *   PUYO_GARBAGE   : 뿌요뿌요 대전에서 상대가 보낸 방해 뿌요(받는 사람에게만). garbage.lines가 개수, holeCol은 쓰지 않아 0
 *
 * [판 전체를 매번 보내는 이유]
 *   "바뀐 부분만" 보내면 데이터는 줄지만, 하나라도 놓치면 화면이 서버와 어긋난다.
 *   오목 판(15×15)은 1KB 정도라 매번 전체를 보내도 부담이 작고, 화면은 받은 상태를 그대로 그리기만 하면 된다.
 *
 * @JsonInclude(NON_NULL): 비어 있는 칸(null)은 JSON에서 빼서 메시지를 짧게 한다.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record OnlineServerMessage(
    String type,
    OnlineRoomView room,
    List<OnlineChatView> chats,
    OnlineErrorView error,
    OnlineGarbageView garbage
) {
    public static OnlineServerMessage roomState(OnlineRoomView room) {
        return new OnlineServerMessage("ROOM_STATE", room, null, null, null);
    }

    public static OnlineServerMessage chats(List<OnlineChatView> chats) {
        return new OnlineServerMessage("CHAT", null, chats, null, null);
    }

    public static OnlineServerMessage error(String code, String message) {
        return new OnlineServerMessage("ERROR", null, null, new OnlineErrorView(code, message), null);
    }

    public static OnlineServerMessage pong() {
        return new OnlineServerMessage("PONG", null, null, null, null);
    }

    public static OnlineServerMessage garbage(int lines, int holeCol, String fromNickname) {
        return new OnlineServerMessage("TETRIS_GARBAGE", null, null, null, new OnlineGarbageView(lines, holeCol, fromNickname));
    }

    public static OnlineServerMessage puyoGarbage(int count, String fromNickname) {
        return new OnlineServerMessage("PUYO_GARBAGE", null, null, null, new OnlineGarbageView(count, 0, fromNickname));
    }
}
