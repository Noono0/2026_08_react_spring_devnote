/**
 * 온라인 대전 화면 테스트. 진짜 서버 대신 가짜 WebSocket(FakeWebSocket)을 끼워
 * "화면이 무엇을 보내는지"와 "서버 메시지를 받으면 무엇을 보여 주는지"를 확인한다.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthSession } from "@/features/auth/api/authApi";
import { createOnlineRoom, getOnlineRooms } from "@/features/games/online/onlineApi";
import type { OnlineRoom } from "@/features/games/online/onlineTypes";
import { OnlineLobbyPage } from "@/features/games/online/pages/OnlineLobbyPage";
import { OnlineRoomScreen } from "@/features/games/online/pages/OnlineRoomScreen";
import { PING_INTERVAL_MS } from "@/features/games/online/useOnlineRoom";
import { installDialogPolyfill } from "@/test/testUtils";

// 테스트에는 .env 값이 없으므로 환경변수 모듈을 고정값으로 바꾼다(HttpClient.test.ts와 같은 방법)
vi.mock("@/shared/config/applicationEnvironment", () => ({
  applicationEnvironment: { VITE_API_BASE_URL: "/api/v1", VITE_HTTP_CLIENT: "axios", VITE_DEVELOPMENT_MEMBER_ID: "1" },
}));
vi.mock("@/features/auth/api/authApi", () => ({ getAuthSession: vi.fn() }));
vi.mock("@/features/games/online/onlineApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/games/online/onlineApi")>()),
  getOnlineGameTypes: vi.fn(() => Promise.resolve([
    { code: "OMOK", label: "오목", minSeats: 2, maxSeats: 2, available: true },
    { code: "CHESS", label: "체스", minSeats: 2, maxSeats: 2, available: false },
  ])),
  getOnlineRooms: vi.fn(),
  createOnlineRoom: vi.fn(),
}));

/** 브라우저 WebSocket 흉내: 보낸 메시지를 모아 두고, 테스트가 서버 역할로 열기·받기·닫기를 일으킨다 */
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.CONNECTING;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    const parsed: unknown = JSON.parse(data);
    this.sent.push(parsed);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  serverOpen() {
    act(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    });
  }

  serverSend(message: object) {
    act(() => this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(message) })));
  }

  serverClose(reason: string) {
    act(() => {
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.(new CloseEvent("close", { reason }));
    });
  }
}

const latestSocket = (): FakeWebSocket => {
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error("WebSocket이 만들어지지 않았습니다.");
  return socket;
};

const baseRoom: OnlineRoom = {
  roomId: "abcd2345", title: "테스트 방", gameType: "OMOK", gameTypeLabel: "오목", seatCount: 2, maxParticipants: 10,
  hasPassword: false, membersOnly: false, status: "WAITING", hostId: "p1", myParticipantId: "p1", seats: [null, null],
  participants: [
    { participantId: "p1", nickname: "철수", member: false, seatIndex: null },
    { participantId: "p2", nickname: "영희", member: false, seatIndex: null },
  ],
  omok: null, lastResult: null,
};

const emptyBoard = () => Array.from({ length: 15 }, () => Array.from({ length: 15 }, () => 0));

const withProviders = (children: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

const renderRoom = (hostToken?: string) => render(withProviders(
  <MemoryRouter><OnlineRoomScreen roomId="abcd2345" nickname="철수" hostToken={hostToken} canUseMembersOnly={false} /></MemoryRouter>,
));

beforeAll(() => installDialogPolyfill());
beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("온라인 대전 방 화면", () => {
  it("연결되면 닉네임·방장 표와 함께 JOIN을 보내고, 25초마다 PING으로 연결을 유지한다", () => {
    vi.useFakeTimers();
    renderRoom("host-token");
    const socket = latestSocket();
    expect(socket.url).toMatch(/\/api\/v1\/online\/ws$/);
    expect(screen.getByRole("status")).toHaveTextContent("연결하는 중");
    socket.serverOpen();
    expect(socket.sent).toEqual([{ type: "JOIN", roomId: "abcd2345", nickname: "철수", hostToken: "host-token" }]);
    act(() => {
      vi.advanceTimersByTime(PING_INTERVAL_MS);
    });
    expect(socket.sent.at(-1)).toEqual({ type: "PING" });
  });

  it("방 상태를 받으면 자리·관전자를 보여 주고, 앉기·채팅은 서버에 부탁만 한다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: baseRoom });
    socket.serverSend({ type: "CHAT", chats: [{ chatId: 1, nickname: null, text: "철수님이 들어왔습니다.", sentAt: 0, system: true, spectator: false }] });

    expect(screen.getByRole("heading", { name: "테스트 방" })).toBeInTheDocument();
    expect(screen.getByText("철수님이 들어왔습니다.")).toBeInTheDocument();
    const seats = screen.getByRole("region", { name: "플레이어와 관전자" });
    fireEvent.click(within(seats).getAllByRole("button", { name: "앉기" })[0] ?? seats);
    expect(socket.sent.at(-1)).toEqual({ type: "SIT", seatIndex: 0 });

    fireEvent.change(screen.getByLabelText("채팅 입력"), { target: { value: "  안녕하세요  " } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "CHAT", text: "안녕하세요" });
    expect(screen.getByLabelText("채팅 입력")).toHaveValue("");

    // 1초에 2개까지: 세 번째는 보내지 않고 쓴 글을 남긴다
    fireEvent.change(screen.getByLabelText("채팅 입력"), { target: { value: "두 번째" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    fireEvent.change(screen.getByLabelText("채팅 입력"), { target: { value: "세 번째" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(socket.sent.filter((message) => JSON.stringify(message).includes("CHAT"))).toHaveLength(2);
    expect(screen.getByLabelText("채팅 입력")).toHaveValue("세 번째");
    expect(screen.getByText(/1초에 2개까지/)).toBeInTheDocument();
  });

  it("내 차례에만 빈 칸을 눌러 돌을 둘 수 있다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    const playing = (turnSeat: number): OnlineRoom => ({
      ...baseRoom, status: "PLAYING", seats: ["p1", "p2"],
      participants: [
        { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
        { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
      ],
      omok: { board: emptyBoard(), turnSeat, winnerSeat: null, draw: false, lastMove: null, winLine: [] },
    });
    socket.serverSend({ type: "ROOM_STATE", room: playing(1) });
    expect(screen.getByText(/○ 백 영희 차례/)).toBeInTheDocument();
    const before = socket.sent.length;
    fireEvent.click(screen.getByRole("button", { name: "8행 8열 빈칸" }));
    expect(socket.sent).toHaveLength(before); // 상대 차례라 보내지 않는다

    socket.serverSend({ type: "ROOM_STATE", room: playing(0) });
    expect(screen.getByText(/내 차례입니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "8행 8열 빈칸" }));
    expect(socket.sent.at(-1)).toEqual({ type: "OMOK_PLACE", row: 7, col: 7 });
  });

  it("비밀번호가 필요하면 입력 칸을 보여 주고 같은 연결로 다시 JOIN한다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ERROR", error: { code: "ONLINE_ROOM_PASSWORD_REQUIRED", message: "비밀번호가 필요한 방입니다." } });
    fireEvent.change(screen.getByLabelText("방 비밀번호"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "들어가기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "JOIN", roomId: "abcd2345", nickname: "철수", password: "1234" });
    socket.serverSend({ type: "ERROR", error: { code: "ONLINE_ROOM_PASSWORD_INVALID", message: "방 비밀번호가 올바르지 않습니다." } });
    expect(screen.getByRole("alert")).toHaveTextContent("5번 틀리면");
  });

  it("연결이 끊기면 이유와 다시 연결 버튼을 보여 주고, 누르면 새로 연결한다", () => {
    renderRoom();
    latestSocket().serverOpen();
    latestSocket().serverClose("비밀번호를 여러 번 틀렸습니다.");
    expect(screen.getByRole("alert")).toHaveTextContent("비밀번호를 여러 번 틀렸습니다.");
    fireEvent.click(screen.getByRole("button", { name: "다시 연결" }));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("방장은 방 정보를 수정할 수 있고, 저장하면 UPDATE_ROOM을 보낸다", async () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: { ...baseRoom, hasPassword: true } });
    const editButton = screen.getByRole("button", { name: "방 정보 수정" });
    await waitFor(() => expect(editButton).toBeEnabled()); // 게임 목록을 받은 뒤 열 수 있다
    fireEvent.click(editButton);
    const dialog = screen.getByRole("dialog", { name: "방 정보 수정" });
    fireEvent.change(within(dialog).getByLabelText("방 제목"), { target: { value: "바뀐 제목" } });
    fireEvent.click(within(dialog).getByLabelText("해제"));
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(socket.sent.at(-1)).toEqual({
      type: "UPDATE_ROOM",
      settings: { title: "바뀐 제목", gameType: "OMOK", seatCount: 2, newPassword: "", removePassword: true, membersOnly: false },
    }));
  });

  it("방장이 아니면 수정 버튼이 없고, 관전자에게는 안내가 보인다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: { ...baseRoom, myParticipantId: "p2" } });
    expect(screen.queryByRole("button", { name: "방 정보 수정" })).not.toBeInTheDocument();
    expect(screen.getByText(/관전 중입니다/)).toBeInTheDocument();
  });
});

describe("온라인 테트리스 대전", () => {
  const emptyText = ".".repeat(200);
  const tetrisRoom = (overrides: Partial<OnlineRoom> = {}): OnlineRoom => ({
    ...baseRoom,
    gameType: "TETRIS", gameTypeLabel: "테트리스 대전", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    tetris: {
      seed: 42, winnerSeat: null,
      players: [
        { seatIndex: 0, nickname: "철수", alive: true, score: 0, lines: 0, board: emptyText, rank: 0 },
        { seatIndex: 1, nickname: "영희", alive: true, score: 120, lines: 2, board: "G".repeat(10) + ".".repeat(190), rank: 0 },
      ],
    },
    ...overrides,
  });

  it("판이 시작되면 같은 seed로 내 게임을 시작하고, 블록이 굳으면 내 판 요약을 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: tetrisRoom() });
    const stage = screen.getByRole("application", { name: /테트리스 대전 내 판/ });
    expect(screen.getByRole("figure", { name: /영희 판, 점수 120/ })).toBeInTheDocument(); // 상대 판 요약
    fireEvent.keyDown(stage, { key: " " }); // 바로 떨어뜨리기 → 굳음
    const boardMessage = socket.sent.find((message) => JSON.stringify(message).includes("TETRIS_BOARD"));
    expect(boardMessage).toMatchObject({ type: "TETRIS_BOARD", lines: 0 });
    expect(JSON.stringify(boardMessage)).toMatch(/"board":"[.IOTSZJLG]{200}"/);
    expect(screen.getByText(/살아남은 사람 2명/)).toBeInTheDocument();
  });

  it("판이 끝난 뒤 다시 시작하면 새 판을 진행하고, 지난 판 상태로 탈락·판 요약을 보내지 않는다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: tetrisRoom() }); // 1판(seed 42)
    socket.serverSend({ type: "ROOM_STATE", room: tetrisRoom({ status: "WAITING", lastResult: "1위 철수 · 2위 영희" }) }); // 끝
    const sentBeforeRestart = socket.sent.length;

    const restarted = tetrisRoom();
    socket.serverSend({ type: "ROOM_STATE", room: { ...restarted, tetris: restarted.tetris ? { ...restarted.tetris, seed: 43 } : null } }); // 다시 시작(seed 43)
    const afterRestart = socket.sent.slice(sentBeforeRestart).map((message) => JSON.stringify(message));
    expect(afterRestart.some((message) => message.includes("TETRIS_TOPPED_OUT"))).toBe(false);
    expect(afterRestart.some((message) => message.includes("TETRIS_BOARD"))).toBe(false);
    expect(screen.queryByText("게임 끝", { selector: ".game-overlay strong" })).not.toBeInTheDocument(); // 내 판이 다시 움직인다
    expect(screen.getByText(/살아남은 사람 2명/)).toBeInTheDocument();
  });

  it("방해 줄을 받으면 알림을 보여 주고 내 판 아래에 회색 줄이 생긴다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: tetrisRoom() });
    socket.serverSend({ type: "TETRIS_GARBAGE", garbage: { lines: 2, holeCol: 3, fromNickname: "영희" } });
    expect(screen.getByText("영희님이 방해 줄 2줄을 보냈습니다!")).toHaveAttribute("role", "status");
    const board = screen.getByRole("img", { name: /내 판/ });
    expect(board.querySelectorAll(".piece-g")).toHaveLength(18); // 2줄 × 9칸(구멍 1칸)
  });

  it("왼쪽에 내 판, 오른쪽에 다른 자리 판들을 놓고 빈 자리는 빈 판으로 보여 준다(시작 전 6인 방)", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: tetrisRoom({
      status: "WAITING", tetris: null, seatCount: 6, seats: ["p1", "p2", null, null, null, null],
    }) });
    expect(screen.getByRole("region", { name: "내 판" })).toHaveTextContent("철수");
    const others = screen.getByRole("region", { name: "다른 플레이어 판" });
    expect(within(others).getAllByRole("figure")).toHaveLength(5);
    expect(within(others).getByRole("figure", { name: "영희 판" })).toBeInTheDocument();
    expect(within(others).getAllByRole("figure", { name: /빈 자리/ })).toHaveLength(4);
    expect(screen.getByText("대기 중", { selector: ".game-overlay strong" })).toBeInTheDocument();
  });

  it("방해 줄 게이지는 받은 줄 수만큼 차고, 다음 블록이 굳으면 비워진다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: tetrisRoom() });
    const meter = screen.getByRole("meter", { name: "받은 방해 줄" });
    expect(meter).toHaveAttribute("aria-valuenow", "0");
    socket.serverSend({ type: "TETRIS_GARBAGE", garbage: { lines: 4, holeCol: 0, fromNickname: "영희" } });
    expect(meter).toHaveAttribute("aria-valuenow", "4");
    fireEvent.keyDown(screen.getByRole("application", { name: /테트리스 대전 내 판/ }), { key: " " });
    expect(meter).toHaveAttribute("aria-valuenow", "0");
  });

  it("관전자는 모든 플레이어의 판을 보고, 탈락한 플레이어는 기권 버튼이 없다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: tetrisRoom({ myParticipantId: "p3", participants: [...tetrisRoom().participants, { participantId: "p3", nickname: "구경", member: false, seatIndex: null }] }) });
    expect(screen.getAllByRole("figure")).toHaveLength(2);
    expect(screen.queryByRole("application")).not.toBeInTheDocument();

    const out = tetrisRoom();
    socket.serverSend({ type: "ROOM_STATE", room: { ...out, tetris: out.tetris ? { ...out.tetris, players: out.tetris.players.map((player) => (player.seatIndex === 0 ? { ...player, alive: false, rank: 2 } : player)) } : null } });
    expect(screen.queryByRole("button", { name: "기권" })).not.toBeInTheDocument();
    expect(screen.getByText(/나는 2위로 탈락/)).toBeInTheDocument();
  });
});

describe("온라인 숫자 야구", () => {
  const baseballRoom = (game: Record<string, unknown>, overrides: Partial<OnlineRoom> = {}): OnlineRoom => ({
    ...baseRoom,
    gameType: "NUMBER_BASEBALL", gameTypeLabel: "숫자 야구", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      phase: "SETUP", digits: 3, mySeat: 0, mySecret: null, secretReady: [false, true], active: [true, true],
      turnSeat: null, targetSeat: null, round: 1, history: [], winners: [], secrets: null, ...game,
    },
    ...overrides,
  });

  const openBaseball = (game: Record<string, unknown>) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: baseballRoom(game) });
    return socket;
  };

  it("준비 단계: 서로 다른 숫자 3개만 비밀 숫자로 보낸다", () => {
    const socket = openBaseball({});
    expect(screen.getByText("준비 완료")).toBeInTheDocument(); // 영희
    const input = screen.getByLabelText(/내 비밀 숫자/);
    fireEvent.change(input, { target: { value: "112" } });
    fireEvent.click(screen.getByRole("button", { name: "숫자 정하기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("서로 다른 숫자 3개");
    fireEvent.change(input, { target: { value: "3a8b2" } }); // 숫자가 아닌 글자는 지운다
    expect(input).toHaveValue("382");
    fireEvent.click(screen.getByRole("button", { name: "숫자 정하기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "SET_SECRET", text: "382" });
  });

  it("진행 단계: 내 차례에만 맞히기 칸이 보이고, 기록에 S·B·OUT이 나온다", () => {
    const socket = openBaseball({
      phase: "PLAY", mySecret: "382", secretReady: [true, true], turnSeat: 0, targetSeat: 1, round: 2,
      history: [{ round: 1, seat: 0, targetSeat: 1, guess: "123", strikes: 1, balls: 1 }, { round: 1, seat: 1, targetSeat: 0, guess: "456", strikes: 0, balls: 0 }],
    });
    expect(screen.getByText("382")).toBeInTheDocument(); // 내 비밀 숫자
    expect(screen.getByText("1S 1B")).toBeInTheDocument();
    expect(screen.getByText("OUT")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("영희의 숫자 맞히기"), { target: { value: "195" } });
    fireEvent.click(screen.getByRole("button", { name: "던지기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "GUESS", text: "195" });

    socket.serverSend({ type: "ROOM_STATE", room: baseballRoom({ phase: "PLAY", mySecret: "382", secretReady: [true, true], turnSeat: 1, targetSeat: 0 }) });
    expect(screen.queryByRole("button", { name: "던지기" })).not.toBeInTheDocument();
  });

  it("끝나면 모두의 숫자를 공개하고 승리를 표시한다", () => {
    openBaseball({ phase: "FINISHED", mySecret: "382", secretReady: [true, true], winners: [0], secrets: ["382", "456"] });
    expect(screen.getByText("숫자 456")).toBeInTheDocument();
    expect(screen.getByText("승리")).toBeInTheDocument();
  });
});

describe("온라인 배틀십", () => {
  const sea = (first: string) => [first, ...Array.from({ length: 9 }, () => "..........")];
  const battleshipRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "BATTLESHIP", gameTypeLabel: "배틀십", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      phase: "PLACE", size: 10, shipLengths: [5, 4, 3, 3, 2], mySeat: 0, ready: [false, false], turnSeat: null, winnerSeat: null, shotsFired: 0,
      boards: [{ seat: 0, rows: sea("SSSSS....."), shipsLeft: 5 }, { seat: 1, rows: sea(".........."), shipsLeft: 5 }],
      ...game,
    },
  });

  it("배치 단계: 다시 배치·준비 완료를 보내고, 내 배는 내 함대에만 보인다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: battleshipRoom({}) });
    const myFleet = screen.getByRole("region", { name: "내 함대" });
    expect(within(myFleet).getAllByRole("img", { name: /내 배/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "다시 배치" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "RANDOMIZE" });
    fireEvent.click(screen.getByRole("button", { name: "준비 완료" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "READY" });
  });

  it("내 차례에 상대 바다의 안 쏜 칸만 누를 수 있다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: battleshipRoom({
      phase: "PLAY", ready: [true, true], turnSeat: 0,
      boards: [{ seat: 0, rows: sea("XSSSS....."), shipsLeft: 5 }, { seat: 1, rows: sea("o#........"), shipsLeft: 4 }],
    }) });
    const enemySea = screen.getByRole("region", { name: "영희의 바다" });
    expect(within(enemySea).queryByRole("button", { name: /^A1 / })).not.toBeInTheDocument(); // 이미 쏜 칸(빗나감)
    expect(within(enemySea).getByRole("img", { name: "B1 격침된 배" })).toBeInTheDocument();
    fireEvent.click(within(enemySea).getByRole("button", { name: "C1 바다 — 쏘기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "FIRE", numbers: [0, 2] });
    expect(within(screen.getByRole("region", { name: "내 함대" })).queryAllByRole("button")).toHaveLength(0);

    socket.serverSend({ type: "ROOM_STATE", room: battleshipRoom({ phase: "PLAY", ready: [true, true], turnSeat: 1 }) });
    expect(within(screen.getByRole("region", { name: "영희의 바다" })).queryAllByRole("button")).toHaveLength(0);
  });
});

describe("온라인 카드 짝 맞추기 대전", () => {
  const hidden = { symbol: null, matchedBy: null, faceUp: false };
  const memoryRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "MEMORY_MATCH", gameTypeLabel: "카드 짝 맞추기 대전", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      mySeat: 0, columns: 4, turnSeat: 0, scores: [1, 0], active: [true, true], winners: [], finished: false,
      cards: [{ symbol: "🍎", matchedBy: 0, faceUp: false }, { symbol: "🍎", matchedBy: 0, faceUp: false }, { symbol: "🍌", matchedBy: null, faceUp: true }, ...Array.from({ length: 13 }, () => hidden)],
      ...game,
    },
  });

  it("내 차례에는 뒷면 카드만 누를 수 있고 FLIP을 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: memoryRoom({}) });
    expect(screen.getByRole("button", { name: "1번 카드 🍎 (철수 짝)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "3번 카드 🍌" })).toBeDisabled(); // 방금 뒤집은 카드
    fireEvent.click(screen.getByRole("button", { name: "4번 카드 (뒷면)" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "FLIP", number: 3 });
    expect(screen.getByText(/남은 짝 7/)).toBeInTheDocument();
  });

  it("상대 차례에는 카드를 누를 수 없다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: memoryRoom({ turnSeat: 1 }) });
    expect(screen.getByRole("button", { name: "4번 카드 (뒷면)" })).toBeDisabled();
    expect(screen.getByText(/영희 차례/)).toBeInTheDocument();
  });
});

describe("온라인 원카드", () => {
  const oneCardRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "ONE_CARD", gameTypeLabel: "원카드", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      mySeat: 0, myHand: [{ id: 4, code: "S5" }, { id: 21, code: "H9" }, { id: 29, code: "D3" }, { id: 6, code: "S7" }],
      handCounts: [4, 6], top: { id: 8, code: "S9" }, currentSuit: "S", anyCard: false, attackPenalty: 0, direction: 1,
      turnSeat: 0, drawPileCount: 30, active: [true, true], ranks: [0, 0], finished: false, ...game,
    },
  });

  it("낼 수 있는 카드만 누를 수 있고, 7은 무늬를 골라 낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: oneCardRoom({}) });
    expect(screen.getByRole("button", { name: "다이아몬드 3 내기" })).toBeDisabled(); // 무늬·숫자 다름
    fireEvent.click(screen.getByRole("button", { name: "하트 9 내기" })); // 숫자 9
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "PLAY", number: 21 });
    fireEvent.click(screen.getByRole("button", { name: "스페이드 7 내기" }));
    fireEvent.click(within(screen.getByRole("group", { name: "바꿀 무늬 고르기" })).getByRole("button", { name: /하트/ }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "PLAY", number: 6, text: "H" });
    fireEvent.click(screen.getByRole("button", { name: "한 장 받기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "DRAW" });
  });

  it("공격받는 중에는 공격 카드만 낼 수 있고 받기 버튼에 장수가 나온다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: oneCardRoom({
      top: { id: 1, code: "S2" }, attackPenalty: 2,
      myHand: [{ id: 0, code: "S1" }, { id: 21, code: "H9" }, { id: 53, code: "CJ" }],
    }) });
    expect(screen.getByRole("button", { name: "하트 9 내기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "스페이드 A 내기" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "컬러 조커 내기" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "2장 받기" })).toBeInTheDocument();
    expect(screen.getByText("공격 +2")).toBeInTheDocument();
  });
});

describe("온라인 블랙잭", () => {
  const blackjackRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "BLACKJACK", gameTypeLabel: "블랙잭", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      phase: "BETTING", round: 1, maxRounds: 5, mySeat: 0, chips: [1000, 1000], bets: [0, 50], hands: [[], []], handValues: [0, 0],
      done: [false, false], active: [true, true], dealerCards: [], dealerValue: null, dealerHidden: false, turnSeat: null,
      lastResults: [], lastDealerCards: [], winners: [], ...game,
    },
  });

  it("베팅 단계: 금액을 골라 BET을 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: blackjackRoom({}) });
    fireEvent.click(screen.getByRole("button", { name: "200" }));
    fireEvent.click(screen.getByRole("button", { name: "200칩 걸기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "BET", number: 200 });
    expect(screen.getByText(/1\/2명 완료/)).toBeInTheDocument();
  });

  it("내 차례: 딜러 두 번째 카드는 뒷면이고 받기·멈추기·더블을 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: blackjackRoom({
      phase: "PLAYING", bets: [100, 50], turnSeat: 0,
      hands: [[{ id: 4, code: "S5" }, { id: 5, code: "S6" }], [{ id: 20, code: "H8" }, { id: 21, code: "H9" }]], handValues: [11, 17],
      dealerCards: [{ id: 30, code: "D5" }, null], dealerValue: 5, dealerHidden: true,
    }) });
    const dealer = screen.getByRole("region", { name: "딜러" });
    expect(within(dealer).getByRole("img", { name: "뒷면 카드" })).toBeInTheDocument();
    expect(within(dealer).getByText("5 + ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "받기 (HIT)" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "HIT" });
    fireEvent.click(screen.getByRole("button", { name: /더블/ }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "DOUBLE" });
  });
});

describe("온라인 섯다", () => {
  const sutdaRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "SUTDA", gameTypeLabel: "섯다", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      phase: "BETTING", round: 2, maxRounds: 6, mySeat: 0, myCards: ["3G", "8G"], chips: [960, 1000], inHand: [true, true], active: [true, true],
      pot: 40, currentBet: 20, contributed: [0, 20], toCall: 20, minRaise: 10, maxRaise: 940, turnSeat: 0, dealerSeat: 1,
      lastRound: { cards: [["1G", "2B"], ["5B", "4B"]], handNames: ["알리", "갑오"], winners: [0], pot: 80, replay: false },
      winners: [], ...game,
    },
  });

  it("내 패를 보여 주고 콜·레이즈·다이를 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: sutdaRoom({}) });
    const hand = screen.getByRole("region", { name: "내 패" });
    expect(within(hand).getByRole("img", { name: "3월 벚꽃 광" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "콜 (20칩)" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "CALL" });
    fireEvent.change(screen.getByLabelText("올릴 칩"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "레이즈 +50" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "RAISE", number: 50 });
    fireEvent.click(screen.getByRole("button", { name: "다이" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "FOLD" });
  });

  it("지난 판에서 공개된 패와 족보를 보여 준다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: sutdaRoom({ turnSeat: 1 }) });
    const last = screen.getByRole("region", { name: "지난 판" });
    expect(within(last).getByText("알리")).toBeInTheDocument();
    expect(within(last).getByText(/철수 승리/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "베팅" })).not.toBeInTheDocument(); // 영희 차례
  });
});

describe("온라인 포커", () => {
  const pokerRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "POKER", gameTypeLabel: "포커", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      phase: "BETTING", handNumber: 1, maxHands: 6, street: "플랍", mySeat: 0, myCards: [{ id: 0, code: "S1" }, { id: 13, code: "H1" }],
      board: [{ id: 26, code: "D1" }, { id: 1, code: "S2" }, { id: 8, code: "S9" }], chips: [980, 980], inHand: [true, true], active: [true, true],
      pot: 40, currentBet: 0, contributed: [0, 0], toCall: 0, minRaise: 20, maxRaise: 980, turnSeat: 0, dealerSeat: 1, lastHand: null, winners: [], ...game,
    },
  });

  it("공용 카드 3장과 빈 자리 2칸, 내 카드를 보여 주고 체크·레이즈·폴드를 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: pokerRoom({}) });
    const table = screen.getByLabelText("공용 카드");
    expect(within(table).getAllByRole("img")).toHaveLength(3);
    expect(within(screen.getByRole("region", { name: "내 카드" })).getByRole("img", { name: "하트 A" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "체크" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "CHECK" });
    fireEvent.click(screen.getByRole("button", { name: "레이즈 +20" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "RAISE", number: 20 });
    fireEvent.click(screen.getByRole("button", { name: "폴드" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "FOLD" });
  });

  it("지난 판에서 공개된 카드와 족보를 보여 준다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: pokerRoom({
      turnSeat: 1,
      lastHand: { cards: [[{ id: 0, code: "S1" }, { id: 13, code: "H1" }], [{ id: 12, code: "S13" }, { id: 32, code: "D7" }]], handNames: ["트리플", "원페어"], board: [], winners: [0], pot: 40 },
    }) });
    const last = screen.getByRole("region", { name: "지난 판" });
    expect(within(last).getByText("트리플")).toBeInTheDocument();
    expect(within(last).getByText(/철수 승리/)).toBeInTheDocument();
  });
});

describe("온라인 체스", () => {
  const start = ["rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNBQKBNR"];
  const chessRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "CHESS", gameTypeLabel: "체스", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      mySeat: 0, myColor: "WHITE", board: start, turnSeat: 0, inCheck: false, lastMove: null,
      legalMoves: [[6, 4, 5, 4], [6, 4, 4, 4]], history: [], capturedByWhite: [], capturedByBlack: [],
      winnerSeat: null, result: null, finished: false, ...game,
    },
  });

  it("내 기물을 고르면 갈 수 있는 칸이 표시되고, 그 칸을 누르면 MOVE를 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: chessRoom({}) });
    fireEvent.click(screen.getByRole("gridcell", { name: "e2 백 폰" }));
    expect(screen.getByRole("gridcell", { name: "e4 (이동 가능)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("gridcell", { name: "e4 (이동 가능)" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "MOVE", numbers: [6, 4, 4, 4] });
  });

  it("폰이 끝 줄에 닿으면 바꿀 기물을 고른 뒤 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    const board = ["....k...", "P.......", "........", "........", "........", "........", "........", "....K..."];
    socket.serverSend({ type: "ROOM_STATE", room: chessRoom({ board, legalMoves: [[1, 0, 0, 0]] }) });
    fireEvent.click(screen.getByRole("gridcell", { name: "a7 백 폰" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "a8 (이동 가능)" }));
    fireEvent.click(within(screen.getByRole("group", { name: "프로모션 기물 고르기" })).getByRole("button", { name: "나이트" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "MOVE", numbers: [1, 0, 0, 0], text: "N" });
  });

  it("흑은 판을 뒤집어 보고, 상대 차례에는 판을 누를 수 없다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: chessRoom({ mySeat: 1, myColor: "BLACK", turnSeat: 1, legalMoves: [], inCheck: true }) });
    const cells = within(screen.getByRole("grid", { name: "체스판" })).getAllByRole("gridcell");
    expect(cells[0]).toHaveAccessibleName("h1 백 룩");
    expect(cells[0]).toBeDisabled();
    expect(screen.getByText(/체크!/)).toBeInTheDocument();
  });
});

describe("온라인 대전 대기실", () => {
  const renderLobby = () => render(withProviders(
    <MemoryRouter initialEntries={["/games/online"]}>
      <Routes>
        <Route path="/games/online" element={<OnlineLobbyPage />} />
        <Route path="/games/online/:roomId" element={<p>방 화면</p>} />
      </Routes>
    </MemoryRouter>,
  ));

  beforeEach(() => {
    vi.mocked(getAuthSession).mockResolvedValue({ authenticated: false, memberName: "", administrator: false, superAdministrator: false });
  });

  it("방 목록을 보여 주고, 로그인 유저만 방은 비회원에게 들어가기 대신 안내를 보인다", async () => {
    vi.mocked(getOnlineRooms).mockResolvedValue([
      { roomId: "aaaa2222", title: "누구나 방", gameType: "OMOK", gameTypeLabel: "오목", seatCount: 2, playerCount: 1, participantCount: 3, maxParticipants: 10, status: "WAITING", hasPassword: true, membersOnly: false, hostNickname: "철수" },
      { roomId: "bbbb3333", title: "회원 방", gameType: "OMOK", gameTypeLabel: "오목", seatCount: 2, playerCount: 2, participantCount: 2, maxParticipants: 10, status: "PLAYING", hasPassword: false, membersOnly: true, hostNickname: "영희" },
    ]);
    renderLobby();
    expect(await screen.findByRole("link", { name: "누구나 방 방 들어가기" })).toHaveAttribute("href", "/games/online/aaaa2222");
    expect(screen.getByText("🔒 비밀번호")).toBeInTheDocument();
    expect(screen.getByText("로그인 필요")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "회원 방 방 들어가기" })).not.toBeInTheDocument();
  });

  it("방이 없으면 빈 안내, 서버가 꺼져 있으면 오류 안내", async () => {
    vi.mocked(getOnlineRooms).mockResolvedValueOnce([]);
    const { unmount } = renderLobby();
    expect(await screen.findByText(/아직 방이 없습니다/)).toBeInTheDocument();
    unmount();
    vi.mocked(getOnlineRooms).mockRejectedValueOnce(new Error("서버 꺼짐"));
    renderLobby();
    expect(await screen.findByText(/방 목록을 불러오지 못했습니다/)).toBeInTheDocument();
  });

  it("방을 만들면 서버에 보내고 받은 방으로 이동한다(비회원은 로그인 유저만 체크 불가)", async () => {
    vi.mocked(getOnlineRooms).mockResolvedValue([]);
    vi.mocked(createOnlineRoom).mockResolvedValue({ roomId: "cccc4444", hostToken: "token" });
    renderLobby();
    const openButton = await screen.findByRole("button", { name: "새 방 만들기" });
    await waitFor(() => expect(openButton).toBeEnabled());
    fireEvent.click(openButton);
    expect(screen.getByLabelText("로그인 유저만 참가")).toBeDisabled();
    expect(screen.getByRole("option", { name: "체스 (준비 중)" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "만들고 들어가기" }));
    expect(await screen.findByText("방 제목을 입력해 주세요.")).toBeInTheDocument(); // 빈 제목은 보내지 않는다
    expect(createOnlineRoom).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("방 제목"), { target: { value: "오목 한 판" } });
    fireEvent.change(screen.getByLabelText("비밀번호 (선택, 4~20자)"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "만들고 들어가기" }));
    expect(await screen.findByText("비밀번호는 4~20자로 입력해 주세요.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("비밀번호 (선택, 4~20자)"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "만들고 들어가기" }));
    expect(await screen.findByText("방 화면")).toBeInTheDocument();
    expect(vi.mocked(createOnlineRoom).mock.calls[0]?.[0]).toEqual({ title: "오목 한 판", gameType: "OMOK", seatCount: 2, password: "1234", membersOnly: false });
  });
});
