import { describe, expect, it, vi } from "vitest";
import { buildOnlineSocketUrl } from "./onlineApi";
import { toBoardText, toRoomSettings } from "./onlineRoomHelpers";
import { createEmptyTetrisBoard } from "@/features/games/tetris/tetrisLogic";
import { CHAT_KEEP_COUNT, findMe, initialOnlineRoomState, onlineRoomReducer, parseServerMessage, type OnlineRoomClientState } from "./onlineRoomReducer";
import type { OnlineRoom, OnlineServerMessage } from "./onlineTypes";

// 테스트에는 .env 값이 없으므로 환경변수 모듈을 고정값으로 바꾼다(HttpClient.test.ts와 같은 방법)
vi.mock("@/shared/config/applicationEnvironment", () => ({
  applicationEnvironment: { VITE_API_BASE_URL: "/api/v1", VITE_HTTP_CLIENT: "axios", VITE_DEVELOPMENT_MEMBER_ID: "1" },
}));

const room: OnlineRoom = {
  roomId: "abcd2345", title: "방", gameType: "OMOK", gameTypeLabel: "오목", seatCount: 2, maxParticipants: 10,
  hasPassword: false, membersOnly: false, status: "WAITING", hostId: "p1", myParticipantId: "p2", seats: [null, "p2"],
  participants: [
    { participantId: "p1", nickname: "철수", member: false, seatIndex: null },
    { participantId: "p2", nickname: "영희", member: true, seatIndex: 1 },
  ],
  omok: null, lastResult: null,
};

const receive = (state: OnlineRoomClientState, message: OnlineServerMessage) => onlineRoomReducer(state, { type: "SERVER_MESSAGE", message });
const chat = (chatId: number) => ({ chatId, nickname: "철수", text: `말 ${chatId}`, sentAt: chatId, system: false, spectator: false });

describe("서버 메시지 검사(parseServerMessage)", () => {
  it("모양이 맞는 메시지만 통과시킨다", () => {
    expect(parseServerMessage(JSON.stringify({ type: "ROOM_STATE", room }))).toEqual({ type: "ROOM_STATE", room });
    expect(parseServerMessage(JSON.stringify({ type: "PONG" }))).toEqual({ type: "PONG" });
    expect(parseServerMessage("JSON 아님")).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "ROOM_STATE", room: { ...room, status: "해킹" } }))).toBeNull();
    expect(parseServerMessage(JSON.stringify({ type: "모르는 종류" }))).toBeNull();
    expect(parseServerMessage(new ArrayBuffer(2))).toBeNull(); // 글자가 아닌 데이터
  });

  it("서버가 빈 값을 null로 보내도 받아들인다(Java record의 null)", () => {
    const withNulls = { ...room, omok: { board: [[0]], turnSeat: 0, winnerSeat: null, draw: false, lastMove: null, winLine: [] } };
    expect(parseServerMessage(JSON.stringify({ type: "ROOM_STATE", room: withNulls }))).not.toBeNull();
  });
});

describe("onlineRoomReducer", () => {
  it("연결 → 열림 → 방 상태를 받으면 방이 보이고 비밀번호 요구가 풀린다", () => {
    let state = onlineRoomReducer(initialOnlineRoomState, { type: "OPEN" });
    state = receive(state, { type: "ERROR", error: { code: "ONLINE_ROOM_PASSWORD_REQUIRED", message: "비밀번호가 필요한 방입니다." } });
    expect(state.passwordRequired).toBe(true);
    state = receive(state, { type: "ROOM_STATE", room });
    expect(state.room).toEqual(room);
    expect(state.passwordRequired).toBe(false);
    expect(state.lastError).toBeNull(); // 들어오기 전 오류는 들어오는 순간 지운다
    const inRoomError = receive(state, { type: "ERROR", error: { code: "ONLINE_NOT_YOUR_TURN", message: "x" } });
    expect(receive(inRoomError, { type: "ROOM_STATE", room }).lastError?.code).toBe("ONLINE_NOT_YOUR_TURN"); // 방 안 오류는 유지
  });

  it("방에 들어온 뒤의 비밀번호 오류(방 정보 수정 등)는 입장 화면으로 돌아가게 하지 않는다", () => {
    const joined = receive({ ...initialOnlineRoomState, connection: "OPEN" }, { type: "ROOM_STATE", room });
    expect(receive(joined, { type: "ERROR", error: { code: "ONLINE_ROOM_PASSWORD_INVALID", message: "x" } }).passwordRequired).toBe(false);
  });

  it("같은 오류가 다시 와도 번호가 늘어 새 알림으로 보인다", () => {
    const error = { type: "ERROR", error: { code: "ONLINE_NOT_YOUR_TURN", message: "지금은 내 차례가 아닙니다." } } as const;
    const once = receive(initialOnlineRoomState, error);
    const twice = receive(once, error);
    expect(twice.lastError?.sequence).toBe(2);
  });

  it("채팅은 겹치지 않게 이어 붙이고 최근 100개만 남긴다(원본 배열은 그대로)", () => {
    const first = receive(initialOnlineRoomState, { type: "CHAT", chats: [chat(1), chat(2)] });
    const second = receive(first, { type: "CHAT", chats: [chat(2), chat(3)] });
    expect(second.chats.map((item) => item.chatId)).toEqual([1, 2, 3]);
    expect(first.chats).toHaveLength(2);
    const many = receive(initialOnlineRoomState, { type: "CHAT", chats: Array.from({ length: 130 }, (_, index) => chat(index)) });
    expect(many.chats).toHaveLength(CHAT_KEEP_COUNT);
    expect(many.chats[0]?.chatId).toBe(30);
  });

  it("끊기면 이유를 기억하고, 다시 연결하면 방·채팅을 비우고 서버가 다시 보내 주길 기다린다", () => {
    const joined = receive(receive(initialOnlineRoomState, { type: "ROOM_STATE", room }), { type: "CHAT", chats: [chat(1)] });
    const closed = onlineRoomReducer(joined, { type: "CLOSED", reason: "비밀번호를 여러 번 틀렸습니다." });
    expect(closed).toMatchObject({ connection: "CLOSED", closedReason: "비밀번호를 여러 번 틀렸습니다." });
    const reconnecting = onlineRoomReducer(closed, { type: "CONNECTING" });
    expect(reconnecting).toMatchObject({ connection: "CONNECTING", room: null, chats: [] });
  });

  it("findMe: 내 자리와 방장 여부", () => {
    expect(findMe(room)).toMatchObject({ mySeat: 1, isHost: false });
    expect(findMe({ ...room, myParticipantId: "p1" })).toMatchObject({ mySeat: null, isHost: true });
  });
});

describe("테트리스 대전 메시지", () => {
  it("방해 줄 메시지는 번호를 붙여 기억하고, 모양이 틀리면 버린다", () => {
    const garbage = { type: "TETRIS_GARBAGE", garbage: { lines: 2, holeCol: 4, fromNickname: "영희" } } as const;
    const once = receive(initialOnlineRoomState, garbage);
    expect(receive(once, garbage).incomingGarbage).toEqual({ lines: 2, holeCol: 4, fromNickname: "영희", sequence: 2 });
    expect(parseServerMessage(JSON.stringify({ type: "TETRIS_GARBAGE", garbage: { lines: 2, holeCol: 10, fromNickname: "x" } }))).toBeNull();
  });

  it("내 판 요약은 숨은 줄을 뺀 200글자", () => {
    const board = createEmptyTetrisBoard().map((row, rowIndex) => (rowIndex === 21 ? row.map((_, colIndex) => (colIndex === 0 ? "G" as const : "T" as const)) : row));
    const text = toBoardText(board);
    expect(text).toHaveLength(200);
    expect(text.slice(190)).toBe("GTTTTTTTTT");
  });
});

describe("뿌요뿌요 대전 메시지", () => {
  it("방해 뿌요 메시지는 번호를 붙여 기억하고, 개수가 범위를 벗어나면 버린다", () => {
    const garbage = { type: "PUYO_GARBAGE", garbage: { lines: 4, holeCol: 0, fromNickname: "영희" } } as const;
    const once = receive(initialOnlineRoomState, garbage);
    expect(once.incomingPuyoGarbage).toEqual({ count: 4, fromNickname: "영희", sequence: 1 });
    expect(receive(once, garbage).incomingPuyoGarbage).toEqual({ count: 4, fromNickname: "영희", sequence: 2 });
    expect(parseServerMessage(JSON.stringify({ type: "PUYO_GARBAGE", garbage: { lines: 0, holeCol: 0, fromNickname: "x" } }))).toBeNull();
  });
});

describe("도우미", () => {
  it("WebSocket 주소: 상대 API 주소는 지금 페이지 주소 기준, https면 wss", () => {
    expect(buildOnlineSocketUrl("/api/v1", "http://localhost:5173/games/online")).toBe("ws://localhost:5173/api/v1/online/ws");
    expect(buildOnlineSocketUrl("/api/v1/", "https://devnote.example.com/x")).toBe("wss://devnote.example.com/api/v1/online/ws");
    expect(buildOnlineSocketUrl("http://localhost:8080/api/v1", "http://localhost:5173/")).toBe("ws://localhost:8080/api/v1/online/ws");
  });

  it("방 정보 수정 값: 비밀번호 그대로·바꾸기·해제·새로 걸기", () => {
    const base = { title: " 새 제목 ", gameType: "OMOK", seatCount: 2, password: "abcd", membersOnly: false, gameOption: "" };
    expect(toRoomSettings({ ...base, passwordMode: "KEEP" }, true)).toMatchObject({ title: "새 제목", newPassword: "", removePassword: false, gameOption: null });
    expect(toRoomSettings({ ...base, gameType: "GAME_2048", gameOption: "256", passwordMode: "KEEP" }, true)).toMatchObject({ gameOption: "256" });
    expect(toRoomSettings({ ...base, passwordMode: "CHANGE" }, true)).toMatchObject({ newPassword: "abcd", removePassword: false });
    expect(toRoomSettings({ ...base, passwordMode: "REMOVE" }, true)).toMatchObject({ newPassword: "", removePassword: true });
    expect(toRoomSettings({ ...base, passwordMode: "CHANGE" }, false)).toMatchObject({ newPassword: "abcd", removePassword: false });
  });
});
