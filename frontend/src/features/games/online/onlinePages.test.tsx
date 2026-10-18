/**
 * 온라인 대전 화면 테스트. 진짜 서버 대신 가짜 WebSocket(FakeWebSocket)을 끼워
 * "화면이 무엇을 보내는지"와 "서버 메시지를 받으면 무엇을 보여 주는지"를 확인한다.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
// 3D 당구대(three.js·WebGL)는 jsdom에서 그릴 수 없으므로, 받은 값을 글자로 보여 주고 콜백을 버튼으로 부르는 가짜로 바꾼다
vi.mock("@/features/games/online/games/billiards/BilliardsTable3D", () => ({
  default: (props: {
    replay: { seq: number } | null; aim: { degrees: number } | null;
    onReplayEnd: () => void; onAimDegrees: (degrees: number) => void; onPlace: (point: { x: number; y: number }) => void;
  }) => (
    <div data-testid="billiards-3d">
      <span>{props.replay ? `재생 ${props.replay.seq}` : "정지"}</span>
      <span>{props.aim ? "조준 가능" : "조준 없음"}</span>
      <button type="button" onClick={props.onReplayEnd}>재생 끝</button>
      <button type="button" onClick={() => props.onAimDegrees(90)}>위로 조준</button>
      <button type="button" onClick={() => props.onPlace({ x: 600, y: 300 })}>여기에 놓기</button>
    </div>
  ),
}));
vi.mock("@/features/games/online/onlineApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/games/online/onlineApi")>()),
  getOnlineGameTypes: vi.fn(() => Promise.resolve([
    { code: "OMOK", label: "오목", minSeats: 2, maxSeats: 2, available: true, options: [], defaultOption: null },
    { code: "CHESS", label: "체스", minSeats: 2, maxSeats: 2, available: false, options: [], defaultOption: null },
    {
      code: "GAME_2048", label: "2048 대전", minSeats: 2, maxSeats: 4, available: true, defaultOption: "512",
      options: [{ code: "256", label: "목표 256" }, { code: "512", label: "목표 512" }, { code: "1024", label: "목표 1024" }, { code: "2048", label: "목표 2048" }],
    },
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
      settings: { title: "바뀐 제목", gameType: "OMOK", seatCount: 2, newPassword: "", removePassword: true, membersOnly: false, gameOption: null },
    }));
  });

  it("방 정보 수정에서 게임을 바꾸면 게임 옵션 칸이 생기고 그 게임의 처음 옵션으로 맞춰진다", async () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: baseRoom });
    const editButton = screen.getByRole("button", { name: "방 정보 수정" });
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    const dialog = screen.getByRole("dialog", { name: "방 정보 수정" });
    expect(within(dialog).queryByLabelText("게임 옵션")).not.toBeInTheDocument(); // 오목은 옵션이 없다
    fireEvent.change(within(dialog).getByLabelText("게임"), { target: { value: "GAME_2048" } });
    expect(within(dialog).getByLabelText("게임 옵션")).toHaveValue("512");
    fireEvent.change(within(dialog).getByLabelText("게임 옵션"), { target: { value: "1024" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(socket.sent.at(-1)).toEqual({
      type: "UPDATE_ROOM",
      settings: { title: "테스트 방", gameType: "GAME_2048", seatCount: 2, newPassword: "", removePassword: false, membersOnly: false, gameOption: "1024" },
    }));
  });

  it("대기 중 방장은 판 아래에서 게임 옵션만 바로 바꾸고, 다른 사람은 옵션을 읽기만 한다", async () => {
    const room2048: OnlineRoom = { ...baseRoom, gameType: "GAME_2048", gameTypeLabel: "2048 대전", gameOption: "512", gameOptionLabel: "목표 512" };
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: room2048 });
    expect(screen.getByText("게임 옵션: 목표 512")).toBeInTheDocument();
    const picker = await screen.findByRole("combobox", { name: "게임 옵션" });
    expect(picker).toHaveValue("512");
    fireEvent.change(picker, { target: { value: "256" } });
    expect(socket.sent.at(-1)).toEqual({
      type: "UPDATE_ROOM",
      settings: { title: "테스트 방", gameType: "GAME_2048", seatCount: 2, newPassword: "", removePassword: false, membersOnly: false, gameOption: "256" },
    });

    socket.serverSend({ type: "ROOM_STATE", room: { ...room2048, myParticipantId: "p2" } });
    expect(screen.queryByRole("combobox", { name: "게임 옵션" })).not.toBeInTheDocument();
    expect(screen.getByText("게임 옵션: 목표 512")).toBeInTheDocument();
  });

  it("방장이 아니면 수정 버튼이 없고, 관전자에게는 안내가 보인다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: { ...baseRoom, myParticipantId: "p2" } });
    expect(screen.queryByRole("button", { name: "방 정보 수정" })).not.toBeInTheDocument();
    expect(screen.getByText(/관전 중입니다/)).toBeInTheDocument();
  });

  it("혼자 연습할 수 있는 게임 방에서는 연습하기가 보이고, 게임이 시작되면 사라진다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: { ...baseRoom, gameType: "TETRIS", gameTypeLabel: "테트리스 대전" } });
    expect(screen.getByRole("region", { name: "혼자 연습하기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "테트리스 연습하기" }));
    expect(screen.getByRole("application", { name: /테트리스 연습 영역/ })).toBeInTheDocument();

    const emptyText = ".".repeat(200);
    socket.serverSend({
      type: "ROOM_STATE",
      room: {
        ...baseRoom, gameType: "TETRIS", gameTypeLabel: "테트리스 대전", status: "PLAYING", seats: ["p1", "p2"],
        participants: [
          { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
          { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
        ],
        tetris: {
          seed: 42, winnerSeat: null,
          players: [
            { seatIndex: 0, nickname: "철수", alive: true, score: 0, lines: 0, board: emptyText, rank: 0 },
            { seatIndex: 1, nickname: "영희", alive: true, score: 0, lines: 0, board: emptyText, rank: 0 },
          ],
        },
      },
    });
    expect(screen.queryByRole("region", { name: "혼자 연습하기" })).not.toBeInTheDocument();
  });

  it("뿌요뿌요 방에서도 연습하기가 보인다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: { ...baseRoom, gameType: "PUYO", gameTypeLabel: "뿌요뿌요 대전", gameOption: "4", gameOptionLabel: "4색" } });
    fireEvent.click(screen.getByRole("button", { name: "뿌요뿌요 연습하기" }));
    expect(screen.getByRole("application", { name: /뿌요뿌요 연습 영역/ })).toBeInTheDocument();
  });

  it("오목처럼 상대가 필요한 게임은 연습하기가 없다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: baseRoom });
    expect(screen.queryByRole("region", { name: "혼자 연습하기" })).not.toBeInTheDocument();
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
      mode: "TWO", phase: "BETTING", round: 2, maxRounds: 6, mySeat: 0, myCards: ["3G", "8G"], myChosen: null, myHandName: "38광땡",
      myCombos: [], chosen: [false, false], cardCounts: [2, 2], chips: [960, 1000], inHand: [true, true], active: [true, true],
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

  it("왼쪽 족보표에서 지금 내 족보를 강조하고, 구사와 멍텅구리구사를 그림으로 구분한다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: sutdaRoom({ myCards: ["4Y", "9Y"], myHandName: "멍텅구리구사" }) });
    expect(within(screen.getByRole("region", { name: "내 패" })).getByText("멍텅구리구사")).toBeInTheDocument();
    const jokbo = screen.getByRole("complementary", { name: "섯다 족보" });
    const current = within(jokbo).getAllByRole("listitem").filter((item) => item.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("멍텅구리구사 ← 내 패");
    // 멍텅구리구사 예시는 두 열끗(두견새·술잔), 구사 예시는 피 두 장 그림이다
    expect(within(current[0]!).getByRole("img", { name: "4월 흑싸리 열끗(두견새)" })).toHaveAttribute("src", "/images/hwatu/Hwatu_April_yul.svg");
    expect(within(current[0]!).getByRole("img", { name: "9월 국진 열끗(술잔)" })).toHaveAttribute("src", "/images/hwatu/Hwatu_September_yul_ssang_pi.svg");
    const gusaRow = within(jokbo).getAllByRole("listitem").find((item) => item.textContent?.startsWith("구사"));
    expect(within(gusaRow!).getByRole("img", { name: "9월 국진 피" })).toHaveAttribute("src", "/images/hwatu/Hwatu_September_pi_1.svg");
  });

  it("3장 섯다에서는 세 가지 조합 중 보여 줄 두 장을 골라 CHOOSE를 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: sutdaRoom({
      mode: "THREE", phase: "CHOOSE", turnSeat: null, myCards: ["3G", "2B", "8G"], myHandName: null, cardCounts: [3, 3], chosen: [false, true],
      myCombos: [{ cards: [0, 1], name: "5끗" }, { cards: [0, 2], name: "38광땡" }, { cards: [1, 2], name: "망통" }],
    }) });
    expect(screen.getByText("보여 줄 두 장을 고르세요.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "영희 자리" })).getAllByRole("img", { name: "뒷면 화투" })).toHaveLength(3);
    expect(within(screen.getByRole("region", { name: "영희 자리" })).getByText("두 장 고름")).toBeInTheDocument();
    const choices = within(screen.getByRole("region", { name: "보여 줄 두 장 고르기" })).getAllByRole("button");
    expect(choices.map((button) => button.textContent)).toEqual([
      "5끗 3월 벚꽃 광 + 2월 매조 피", "38광땡 3월 벚꽃 광 + 8월 공산 광", "망통 2월 매조 피 + 8월 공산 광",
    ]);
    fireEvent.click(choices[1]!);
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "CHOOSE", numbers: [0, 2] });
    expect(screen.queryByRole("group", { name: "베팅" })).not.toBeInTheDocument();
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

describe("온라인 마피아", () => {
  const players = (count: number) => Array.from({ length: count }, (_, seat) => ({ participantId: `p${seat + 1}`, nickname: ["철수", "영희", "민수", "지수"][seat] ?? `${seat}`, member: false, seatIndex: seat }));
  const mafiaRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "MAFIA", gameTypeLabel: "마피아", status: "PLAYING", seats: ["p1", "p2", "p3", "p4"],
    participants: players(4),
    game: {
      mySeat: 0, myRole: "MAFIA", phase: "NIGHT", round: 1,
      players: [{ alive: true, role: "MAFIA", done: false }, { alive: true, role: null, done: false }, { alive: true, role: null, done: false }, { alive: true, role: null, done: false }],
      myChoice: null, mafiaChoices: {}, investigations: [], log: ["게임 시작!"], winnerTeam: null, finished: false, ...game,
    },
  });

  it("밤에는 내 직업과 지목 버튼을 보여 주고 TARGET을 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: mafiaRoom({}) });
    expect(screen.getByRole("region", { name: "내 직업" })).toHaveTextContent("나의 직업: 마피아");
    const list = screen.getByRole("list", { name: "플레이어" });
    expect(within(list).getAllByRole("button", { name: "지목" })).toHaveLength(3); // 나(마피아)는 빼고
    fireEvent.click(within(list).getAllByRole("button", { name: "지목" })[1]!);
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "TARGET", number: 2 });
  });

  it("낮에는 투표·건너뛰기를 보내고, 경찰은 조사 결과를 본다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: mafiaRoom({
      myRole: "POLICE", phase: "DAY",
      players: [{ alive: true, role: "POLICE", done: true }, { alive: true, role: null, done: false }, { alive: false, role: null, done: false }, { alive: true, role: null, done: false }],
      investigations: [{ seat: 1, mafia: true }],
    }) });
    expect(screen.getByRole("region", { name: "조사 결과" })).toHaveTextContent("영희: 마피아입니다!");
    expect(screen.getByText(/투표 1\/3/)).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "플레이어" });
    expect(within(list).getAllByRole("button", { name: "투표" })).toHaveLength(2); // 나와 탈락자는 빼고
    fireEvent.click(within(list).getAllByRole("button", { name: "투표" })[0]!);
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "VOTE", number: 1 });
    fireEvent.click(screen.getByRole("button", { name: "투표 건너뛰기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "VOTE", number: -1 });
  });

  it("시민은 밤에 버튼 없이 기다리고, 탈락하면 안내만 보인다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: mafiaRoom({ myRole: "CITIZEN", players: [{ alive: true, role: "CITIZEN", done: false }, { alive: true, role: null, done: false }, { alive: true, role: null, done: false }, { alive: true, role: null, done: false }] }) });
    expect(screen.getByText(/시민은 밤에 할 일이 없습니다/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "플레이어" })).queryAllByRole("button")).toHaveLength(0);
    socket.serverSend({ type: "ROOM_STATE", room: mafiaRoom({ myRole: "CITIZEN", phase: "DAY", players: [{ alive: false, role: "CITIZEN", done: false }, { alive: true, role: null, done: false }, { alive: true, role: null, done: false }, { alive: true, role: null, done: false }] }) });
    expect(screen.getByText(/탈락했습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "투표 건너뛰기" })).not.toBeInTheDocument();
  });
});

describe("온라인 스도쿠", () => {
  // 정답 판에서 (1행 3열)=4, (1행 4열)=6, (9행 9열)=9 세 칸만 비운 문제
  const givens = ["53..78912", "672195348", "198342567", "859761423", "426853791", "713924856", "961537284", "287419635", "34528617."];
  const solution = ["534678912", "672195348", "198342567", "859761423", "426853791", "713924856", "961537284", "287419635", "345286179"];
  const sudokuRoom = (game: Record<string, unknown>, room: Partial<OnlineRoom> = {}): OnlineRoom => ({
    ...baseRoom,
    gameType: "SUDOKU", gameTypeLabel: "스도쿠", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      mySeat: 0, emptyCells: 3, givens, myBoard: givens, players: [{ filled: 0, active: true }, { filled: 2, active: true }],
      winners: [], finished: false, solution: null,
      ...game,
    },
    ...room,
  });
  const openSudoku = (game: Record<string, unknown>, room: Partial<OnlineRoom> = {}) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: sudokuRoom(game, room) });
    return socket;
  };

  it("빈 칸을 고르고 숫자 버튼이나 키보드로 넣으면 PLACE를 보낸다", () => {
    const socket = openSudoku({});
    expect(screen.getByText("2/3칸")).toBeInTheDocument(); // 영희는 채운 칸 수만 보인다
    fireEvent.click(screen.getByRole("button", { name: "1행 3열, 빈 칸" }));
    fireEvent.click(screen.getByRole("button", { name: "숫자 4" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "PLACE", numbers: [0, 2], number: 4 });

    const nextCell = screen.getByRole("button", { name: "1행 4열, 빈 칸" });
    fireEvent.click(nextCell);
    fireEvent.keyDown(nextCell, { key: "6" });
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "PLACE", numbers: [0, 3], number: 6 });
  });

  it("고정 숫자 칸은 바꾸지 않고, 넣은 숫자는 지우기로 CLEAR를 보낸다", () => {
    const socket = openSudoku({ myBoard: ["534.78912", ...givens.slice(1)], players: [{ filled: 1, active: true }, { filled: 0, active: true }] });
    const sentBefore = socket.sent.length;
    fireEvent.click(screen.getByRole("button", { name: "1행 1열, 고정 숫자 5" }));
    fireEvent.click(screen.getByRole("button", { name: "숫자 4" }));
    expect(socket.sent).toHaveLength(sentBefore);

    // 내가 넣은 숫자만 동그라미(sudoku-entry) 안에 그린다. 고정 숫자는 그냥 숫자다
    expect(within(screen.getByRole("button", { name: "1행 3열, 4" })).getByText("4")).toHaveClass("sudoku-entry");
    expect(screen.getByRole("button", { name: "1행 1열, 고정 숫자 5" }).children).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "1행 3열, 4" }));
    fireEvent.click(screen.getByRole("button", { name: "지우기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "CLEAR", numbers: [0, 2] });
  });

  it("관전자에게는 숫자 버튼이 없고 문제만 보인다", () => {
    openSudoku({ mySeat: null, myBoard: null }, {
      myParticipantId: "p3",
      participants: [
        { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
        { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
        { participantId: "p3", nickname: "구경", member: false, seatIndex: null },
      ],
    });
    expect(screen.getByRole("group", { name: "스도쿠 문제" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "숫자 넣기" })).not.toBeInTheDocument();
    expect(screen.getByText(/플레이어의 판은 끝날 때까지 비공개/)).toBeInTheDocument();
  });

  it("끝나면 정답이 공개되어 틀린 숫자와 못 채운 칸의 정답을 보여 준다", () => {
    openSudoku({ myBoard: ["536.78912", ...givens.slice(1)], winners: [1], finished: true, solution }, { status: "WAITING", lastResult: "스도쿠 영희 승리 — 가장 먼저 완성" });
    expect(screen.getByRole("button", { name: "1행 3열, 6 (틀림, 정답 4)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1행 4열, 빈 칸 (정답 6)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "숫자 4" })).toBeDisabled();
    expect(screen.getByText(/· 승리/)).toBeInTheDocument();
  });
});

const twoPlayers = {
  status: "PLAYING" as const, seats: ["p1", "p2"],
  participants: [
    { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
    { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
  ],
};

describe("온라인 2048 대전", () => {
  // 왼쪽 위 2 하나: 왼쪽·위로는 밀어도 그대로, 오른쪽·아래로는 움직인다
  const board = [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const open2048 = (me: Record<string, unknown> = {}) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({
      type: "ROOM_STATE",
      room: {
        ...baseRoom, ...twoPlayers, gameType: "GAME_2048", gameTypeLabel: "2048 대전", gameOption: "512", gameOptionLabel: "목표 512",
        game: {
          mySeat: 0, target: 512, winners: [], finished: false,
          players: [
            { nickname: "철수", board, score: 0, moves: 0, status: "PLAYING", ...me },
            { nickname: "영희", board: [[4, 8, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 2]], score: 12, moves: 3, status: "PLAYING" },
          ],
        },
      },
    });
    return socket;
  };

  it("방향키·버튼으로 MOVE를 보내고, 밀어도 그대로인 방향은 보내지 않는다", () => {
    const socket = open2048();
    const myBoard = screen.getByRole("grid", { name: /내 2048 판\(목표 512\)/ });
    const sentBefore = socket.sent.length;
    fireEvent.keyDown(myBoard, { key: "ArrowLeft" });
    fireEvent.keyDown(myBoard, { key: "w" });
    expect(socket.sent).toHaveLength(sentBefore);

    fireEvent.keyDown(myBoard, { key: "ArrowRight" });
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "MOVE", text: "RIGHT" });
    fireEvent.click(screen.getByRole("button", { name: "아래으로 밀기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "MOVE", text: "DOWN" });
  });

  it("다른 사람의 판은 오른쪽 작은 판으로 점수·이동 수와 함께 보인다", () => {
    open2048();
    const other = screen.getByRole("figure", { name: "영희 판, 12점 · 3번, 진행 중" });
    expect(within(other).getByText("8")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기권" })).toBeInTheDocument();
  });

  it("먼저 목표를 만들면 조작이 막히고 기권 버튼이 사라진다", () => {
    const socket = open2048({ status: "SUCCESS", moves: 40, finishOrder: 1 });
    expect(screen.getByText(/512 타일을 40번 만에 만들었습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "오른쪽으로 밀기" })).toBeDisabled();
    const sentBefore = socket.sent.length;
    fireEvent.keyDown(screen.getByRole("grid", { name: /내 2048 판/ }), { key: "ArrowRight" });
    expect(socket.sent).toHaveLength(sentBefore);
    expect(screen.queryByRole("button", { name: "기권" })).not.toBeInTheDocument();
  });
});

describe("온라인 지뢰 찾기 대전", () => {
  // 3×3, 지뢰 1개(오른쪽 열 어딘가). 미리 열린 칸: 1열 "0", 2열 "1"
  const openBoard = ["01.", "01.", "01."];
  const openMinesweeper = (game: Record<string, unknown> = {}, room: Partial<OnlineRoom> = {}) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({
      type: "ROOM_STATE",
      room: {
        ...baseRoom, ...twoPlayers, gameType: "MINESWEEPER", gameTypeLabel: "지뢰 찾기 대전", gameOption: "BEGINNER", gameOptionLabel: "초급",
        game: {
          mySeat: 0, difficulty: "BEGINNER", rows: 3, cols: 3, mines: 1, safeCells: 8, winners: [], finished: false,
          players: [
            { nickname: "철수", board: openBoard, clicks: 0, revealed: 6, flags: 0, status: "PLAYING" },
            { nickname: "영희", board: ["01.", "01.", "011"], clicks: 1, revealed: 7, flags: 0, status: "PLAYING" },
          ],
          ...game,
        },
        ...room,
      },
    });
    return socket;
  };

  it("닫힌 칸은 REVEAL, 열린 숫자는 CHORD, 오른쪽 클릭은 FLAG를 보내고 빈 칸 0은 보내지 않는다", () => {
    const socket = openMinesweeper();
    fireEvent.click(screen.getByRole("button", { name: "1행 3열, 닫힘" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "REVEAL", numbers: [0, 2] });
    fireEvent.click(screen.getByRole("button", { name: "2행 2열, 주변 지뢰 1개" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "CHORD", numbers: [1, 1] });
    fireEvent.contextMenu(screen.getByRole("button", { name: "3행 3열, 닫힘" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "FLAG", numbers: [2, 2] });

    const sentBefore = socket.sent.length;
    fireEvent.click(screen.getByRole("button", { name: "1행 1열, 빈 칸" }));
    expect(socket.sent).toHaveLength(sentBefore);
    expect(screen.getByRole("figure", { name: "영희 판, 7/8칸 · 1번, 진행 중" })).toBeInTheDocument();
  });

  it("방향키로 칸을 옮기고(로빙 탭인덱스) F로 깃발, 깃발 모드에서는 눌러서 깃발을 꽂는다", () => {
    const socket = openMinesweeper();
    const first = screen.getByRole("button", { name: "1행 1열, 빈 칸" });
    expect(first).toHaveAttribute("tabindex", "0");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement ?? first, { key: "ArrowRight" });
    const third = screen.getByRole("button", { name: "1행 3열, 닫힘" });
    expect(third).toHaveFocus();
    expect(third).toHaveAttribute("tabindex", "0");
    expect(first).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(third, { key: "f" });
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "FLAG", numbers: [0, 2] });

    fireEvent.click(screen.getByRole("button", { name: /깃발 모드 꺼짐/ }));
    fireEvent.click(screen.getByRole("button", { name: "2행 3열, 닫힘" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "FLAG", numbers: [1, 2] });
  });

  it("게임 중에는 지뢰가 보이지 않고, 끝나면 밟은 지뢰·지뢰·틀린 깃발이 공개된다", () => {
    openMinesweeper();
    expect(screen.queryByRole("button", { name: /지뢰$/ })).not.toBeInTheDocument();
    cleanup();
    openMinesweeper({
      finished: true, winners: [1],
      players: [
        { nickname: "철수", board: ["01X", "01W", "01."], clicks: 1, revealed: 6, flags: 1, status: "FAILED", rank: 2 },
        { nickname: "영희", board: ["01*", "011", "011"], clicks: 2, revealed: 8, flags: 0, status: "SUCCESS", rank: 1, finishOrder: 1 },
      ],
    }, { status: "WAITING", lastResult: "지뢰 찾기 대전(초급) 1위 영희 2번 클릭으로 성공 · 2위 철수 6칸" });
    expect(screen.getByRole("button", { name: "1행 3열, 밟은 지뢰" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2행 3열, 틀린 깃발" })).toBeInTheDocument();
    expect(screen.getByText(/지뢰 위치가 공개되었습니다/)).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "영희 판, 8/8칸 · 2번, 성공, 1위" })).toBeInTheDocument();
  });
});

describe("온라인 당구", () => {
  const caromBalls = [{ id: 0, x: 711, y: 863, pocketed: false }, { id: 1, x: 711, y: 711, pocketed: false }, { id: 2, x: 2133, y: 711, pocketed: false }];
  const shot = (seq: number, summary: string) => ({ seq, shooterSeat: 1, cueBall: 1, frames: [[711, 863, 711, 711, 2133, 711]], events: [], durationMs: 1000, summary });
  const billiardsRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "BILLIARDS", gameTypeLabel: "당구", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: {
      variant: "THREE_CUSHION", variantLabel: "3쿠션", tableLength: 2844, tableWidth: 1422, ballRadius: 30.75, pockets: false,
      balls: caromBalls, mySeat: 0, turnSeat: 0, cueBalls: [0, 1], scores: [0, 0], target: 10, innings: [1, 0], groups: [null, null],
      ballInHand: false, lastShot: null, winners: [], result: null, finished: false, ...game,
    },
  });
  const openBilliards = async (game: Record<string, unknown>) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: billiardsRoom(game) });
    await screen.findByTestId("billiards-3d");
    return socket;
  };

  it("조준·힘·당점을 골라 SHOT을 보낸다", async () => {
    const socket = await openBilliards({});
    expect(screen.getByText("조준 가능")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "위로 조준" }));
    expect(screen.getByLabelText(/조준 각도 90.00°/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^힘/), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "밀어치기" }));
    fireEvent.click(screen.getByRole("button", { name: "치기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "SHOT", numbers: [90_000, 60, 0, 35] });
  });

  it("새 샷이 오면 궤적을 재생하는 동안 조작을 막고, 끝나면 결과를 보여 준다", async () => {
    const socket = await openBilliards({ lastShot: shot(1, "두 공을 다 맞히지 못함") });
    expect(screen.getByText("정지")).toBeInTheDocument(); // 들어오기 전 샷은 재생하지 않는다
    socket.serverSend({ type: "ROOM_STATE", room: billiardsRoom({ lastShot: shot(2, "3쿠션 성공! (두 번째 공 전에 쿠션 3번)") }) });
    expect(screen.getByText("재생 2")).toBeInTheDocument();
    expect(screen.getByText("조준 없음")).toBeInTheDocument();
    expect(screen.getByText(/영희 샷 재생 중/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "치기" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "재생 끝" }));
    expect(screen.getByText("정지")).toBeInTheDocument();
    expect(screen.getByText(/지난 샷\(영희\): 3쿠션 성공/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "치기" })).toBeEnabled();
  });

  it("8볼 파울 뒤에는 수구를 원하는 곳에 놓는다(PLACE)", async () => {
    const poolBalls = [{ id: 0, x: 635, y: 635, pocketed: false }, { id: 8, x: 1950, y: 635, pocketed: false }];
    const socket = await openBilliards({
      variant: "EIGHT_BALL", variantLabel: "8볼 포켓", tableLength: 2540, tableWidth: 1270, ballRadius: 28.575, pockets: true,
      balls: poolBalls, cueBalls: [0, 0], groups: ["SOLID", "STRIPE"], ballInHand: true,
    });
    expect(screen.getByText("솔리드 · 남은 공 0개")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수구 옮기기" }));
    fireEvent.click(screen.getByRole("button", { name: "여기에 놓기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "PLACE", numbers: [600, 300] });
  });

  it("상대 차례에는 샷 조작이 보이지 않는다", async () => {
    await openBilliards({ turnSeat: 1 });
    expect(screen.getByText("영희 차례")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "치기" })).not.toBeInTheDocument();
    expect(screen.getByText("조준 없음")).toBeInTheDocument();
  });
});

describe("온라인 사과게임 대전", () => {
  const row = (digits: string) => digits.padEnd(17, "1");
  const appleRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    ...twoPlayers,
    gameType: "APPLE", gameTypeLabel: "사과게임 대전",
    game: {
      mySeat: 0, myBoard: [row("19"), ...Array.from({ length: 9 }, () => row(""))], scores: [4, 6], remaining: [166, 164],
      active: [true, true], deadline: Date.now() + 60_000, log: [], winnerSeats: [], finished: false, ...game,
    },
  });
  const openApple = (game: Record<string, unknown>) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: appleRoom(game) });
    return socket;
  };

  it("두 칸으로 사각형을 고르면 SELECT를 보내고, 점수·남은 시간을 보여 준다", () => {
    const socket = openApple({});
    expect(screen.getByRole("timer", { name: /남은 시간 (59|60)초/ })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "점수" })).toHaveTextContent("철수 (나)4개 · 남은 사과 166");
    fireEvent.click(screen.getByRole("gridcell", { name: /^1줄 2칸 사과 9/ }));
    expect(screen.getByText("고른 사과 합: 9")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("gridcell", { name: /^1줄 1칸 사과 1/ }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "SELECT", numbers: [0, 0, 0, 1] });
  });

  it("끝나면 승자를 보여 주고 판을 잠근다", () => {
    openApple({ finished: true, deadline: null, winnerSeats: [1] });
    expect(screen.getByText("영희 승리!")).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /^1줄 1칸/ })).toBeDisabled();
  });
});

describe("온라인 수박게임 대전", () => {
  const suikaRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    ...twoPlayers,
    gameType: "SUIKA", gameTypeLabel: "수박게임 대전",
    game: {
      mySeat: 0, seed: 1234, scores: [12, 30], over: [false, true], active: [true, true], deadline: Date.now() + 120_000,
      log: [], winnerSeats: [], finished: false, ...game,
    },
  });
  const openSuika = (game: Record<string, unknown>) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: suikaRoom(game) });
    return socket;
  };

  it("점수판과 남은 시간을 보여 주고, 내 상자에서 과일을 떨어뜨릴 수 있다", () => {
    openSuika({});
    expect(screen.getByRole("list", { name: "점수" })).toHaveTextContent("영희30점 · 넘침");
    expect(screen.getByRole("timer")).toBeInTheDocument();
    const board = screen.getByRole("application", { name: /수박게임 상자/ });
    fireEvent.keyDown(board, { key: " " });
    expect(board.querySelectorAll("circle.suika-fruit")).toHaveLength(1);
  });

  it("내 상자가 넘쳤으면 판이 멈추고, 끝나면 승자를 보여 준다", () => {
    openSuika({ over: [true, false] });
    expect(screen.getByText("내 상자가 넘쳤어요. 다른 사람을 기다리는 중…")).toBeInTheDocument();
    cleanup();
    openSuika({ finished: true, deadline: null, winnerSeats: [1] });
    expect(screen.getByText("영희 승리!")).toBeInTheDocument();
  });
});

describe("온라인 장기", () => {
  const startBoard = [
    "rheaaaher".replace("aaa", "a.a"), "....k....", ".c.....c.", "p.p.p.p.p", ".........",
    ".........", "P.P.P.P.P", ".C.....C.", "....K....", "RHEA.AHER",
  ];
  const janggiRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    ...twoPlayers,
    gameType: "JANGGI", gameTypeLabel: "장기",
    game: {
      mySeat: 0, phase: "PLAY", board: startBoard, arranged: [true, true], myFormation: "HEHE", turnSeat: 0, inCheck: false, bikjang: false,
      moves: [{ fromRow: 6, fromCol: 0, toRow: 5, toCol: 0 }, { fromRow: 6, fromCol: 0, toRow: 6, toCol: 1 }],
      canPass: true, lastMove: null, scores: [144, 147], moveCount: 0, log: [], winnerSeat: null, result: null, finished: false, ...game,
    },
  });
  const openJanggi = (game: Record<string, unknown>) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: janggiRoom(game) });
    return socket;
  };

  it("상차림 단계에서는 네 가지 마·상 위치를 골라 ARRANGE를 보낸다", () => {
    const socket = openJanggi({ phase: "SETUP", arranged: [false, true], myFormation: null, moves: [], canPass: false });
    expect(screen.getByText("한 · 영희")).toBeInTheDocument();
    expect(screen.getByText("상차림 고름")).toBeInTheDocument();
    const choices = within(screen.getByRole("group", { name: "상차림 고르기" })).getAllByRole("button");
    expect(choices.map((button) => button.querySelector("strong")?.textContent)).toEqual(["마상마상", "상마상마", "마상상마", "상마마상"]);
    fireEvent.click(choices[2]!);
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "ARRANGE", text: "HEEH" });
  });

  it("내 기물을 누르면 갈 수 있는 점이 표시되고, 그 점을 누르면 MOVE를 보낸다", () => {
    const socket = openJanggi({});
    const board = screen.getByRole("grid", { name: "장기판" });
    fireEvent.click(within(board).getByRole("gridcell", { name: "7줄 1칸 초 졸" }));
    const target = within(board).getByRole("gridcell", { name: "6줄 1칸 (이동 가능)" });
    fireEvent.click(target);
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "MOVE", numbers: [6, 0, 5, 0] });
    fireEvent.click(screen.getByRole("button", { name: "한 수 쉬기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "PASS" });
  });

  it("한은 판을 돌려 보고, 장군이면 알려 준다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    // 내 자리(mySeat)는 방의 자리 목록에서 정해진다. 영희(p2, 1번 자리 = 한)로 들어온 상태
    socket.serverSend({ type: "ROOM_STATE", room: { ...janggiRoom({ mySeat: 1, turnSeat: 1, inCheck: true, canPass: false, moves: [] }), myParticipantId: "p2" } });
    const cells = within(screen.getByRole("grid", { name: "장기판" })).getAllByRole("gridcell");
    expect(cells[0]).toHaveAccessibleName("10줄 9칸 초 차"); // 한 쪽에서 보면 왼쪽 위가 초의 오른쪽 차
    expect(screen.getByText(/장군!/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "한 수 쉬기" })).not.toBeInTheDocument();
  });

  it("빅장이면 이번 수에 풀어야 한다고 알려 준다", () => {
    openJanggi({ bikjang: true });
    expect(screen.getByText(/빅장! 이번 수에 풀지 않으면 점수로 끝나요/)).toBeInTheDocument();
  });
});

describe("온라인 알까기", () => {
  const alkkagiRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    ...twoPlayers,
    gameType: "ALKKAGI", gameTypeLabel: "알까기",
    game: {
      mySeat: 0, mode: "STANDARD", phase: "PLAY", maxStones: 2, placedCounts: [0, 0], ready: [false, false], turnSeat: 0,
      stones: [{ side: 0, x: 300, y: 800, alive: true }, { side: 0, x: 700, y: 800, alive: true }, { side: 1, x: 500, y: 200, alive: true }],
      remaining: [2, 1], shotCount: 0, lastShot: null, log: [], winnerSeat: null, finished: false, ...game,
    },
  });
  const openAlkkagi = (game: Record<string, unknown>) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: alkkagiRoom(game) });
    return socket;
  };

  it("내 알을 고르고 각도·힘을 정해 FLICK을 보낸다", () => {
    const socket = openAlkkagi({});
    expect(screen.getByRole("img", { name: "알까기 판: 흑 2개, 백 1개" })).toBeInTheDocument();
    const controls = screen.getByRole("group", { name: "튕기기 조작" });
    const flickButton = within(controls).getByRole("button", { name: "튕기기" });
    expect(flickButton).toBeDisabled();
    fireEvent.change(within(controls).getByLabelText("내 알"), { target: { value: "1" } });
    fireEvent.change(within(controls).getByLabelText(/각도/), { target: { value: "100" } });
    fireEvent.change(within(controls).getByLabelText(/힘/), { target: { value: "75" } });
    fireEvent.click(flickButton);
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "FLICK", numbers: [1, 100, 75] });
    // 상대 알은 고를 목록에 없다
    expect(within(within(controls).getByLabelText("내 알")).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "고르기", "1번 알 (300, 800)", "2번 알 (700, 800)",
    ]);
  });

  it("커스텀 배치 중에는 칸·줄로 알을 놓고, 개수가 차면 배치 완료를 보낸다", () => {
    const socket = openAlkkagi({
      mode: "CUSTOM", phase: "SETUP", maxStones: 3, placedCounts: [2, 1], ready: [false, true],
      stones: [{ side: 0, x: 500, y: 800, alive: true }, { side: 0, x: 200, y: 850, alive: true }], remaining: [0, 0],
    });
    expect(screen.getByText("커스텀 · 최대 3개")).toBeInTheDocument();
    expect(screen.getByText(/아래 절반\)의 교차점을 눌러 알을 놓으세요.*\(2\/3개\)/)).toBeInTheDocument();
    expect(screen.getByText(/백 · 영희 — 놓은 알 1 · 완료/)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "튕기기 조작" })).not.toBeInTheDocument(); // 배치 중에는 튕길 수 없다
    const controls = screen.getByRole("group", { name: "알 배치" });
    fireEvent.change(within(controls).getByLabelText("칸(1~19)"), { target: { value: "4" } });
    fireEvent.change(within(controls).getByLabelText("줄(11~19)"), { target: { value: "17" } });
    fireEvent.click(within(controls).getByRole("button", { name: "놓기·빼기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "PLACE", numbers: [3, 16] }); // 서버는 0부터 센다
    fireEvent.click(within(controls).getByRole("button", { name: "모두 빼기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "CLEAR" });
    fireEvent.click(within(controls).getByRole("button", { name: "배치 완료 (2/3)" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "READY" });
  });

  it("배치를 마치면 상대를 기다리고, 알을 하나도 안 놓았으면 완료할 수 없다", () => {
    openAlkkagi({ mode: "CUSTOM", phase: "SETUP", maxStones: 3, placedCounts: [0, 2], ready: [false, false], stones: [], remaining: [0, 0] });
    expect(within(screen.getByRole("group", { name: "알 배치" })).getByRole("button", { name: "배치 완료 (0/3)" })).toBeDisabled();
    cleanup();
    openAlkkagi({ mode: "CUSTOM", phase: "SETUP", maxStones: 3, placedCounts: [2, 2], ready: [true, false], remaining: [0, 0] });
    expect(screen.getByText("배치 완료! 상대(2개 놓는 중)를 기다리는 중…")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "알 배치" })).not.toBeInTheDocument();
  });

  it("백은 판을 돌려 보고, 화면 위쪽(90도)으로 튕기면 판 기준 270도로 보낸다", () => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: { ...alkkagiRoom({ mySeat: 1, turnSeat: 1 }), myParticipantId: "p2" } });
    const board = screen.getByRole("img", { name: /알까기 판/ });
    expect(board.querySelector("g")).toHaveAttribute("transform", "rotate(180 500 500)");
    const controls = screen.getByRole("group", { name: "튕기기 조작" });
    fireEvent.change(within(controls).getByLabelText("내 알"), { target: { value: "2" } });
    fireEvent.change(within(controls).getByLabelText(/각도/), { target: { value: "90" } });
    fireEvent.change(within(controls).getByLabelText(/힘/), { target: { value: "40" } });
    fireEvent.click(within(controls).getByRole("button", { name: "튕기기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "FLICK", numbers: [2, 270, 40] });
  });

  it("상대 차례에는 조작이 없다", () => {
    openAlkkagi({ turnSeat: 1 });
    expect(screen.queryByRole("group", { name: "튕기기 조작" })).not.toBeInTheDocument();
    expect(screen.getByText("백(영희) 차례")).toBeInTheDocument();
  });
});

describe("온라인 윷놀이", () => {
  const yutnoriRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    ...twoPlayers,
    gameType: "YUTNORI", gameTypeLabel: "윷놀이",
    game: {
      mySeat: 0, turnSeat: 0, phase: "THROW", pendingThrows: [], pieces: [[0, 0, 0, 0], [3, 0, 0, 0]], active: [true, true],
      moves: [], log: ["윷놀이 시작!"], winnerSeat: null, finished: false, ...game,
    },
  });
  const openYutnori = (game: Record<string, unknown>) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: yutnoriRoom(game) });
    return socket;
  };

  it("내 차례에는 윷 던지기 버튼으로 THROW를 보낸다", () => {
    const socket = openYutnori({});
    expect(screen.getByText("내 차례입니다. 윷을 던지세요.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "윷판" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "윷 던지기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "THROW" });
  });

  it("모아 둔 결과로 옮길 말을 고르면 MOVE를 보낸다", () => {
    const socket = openYutnori({
      phase: "MOVE", pendingThrows: ["YUT", "GAE"], pieces: [[6, 6, 0, 0], [3, 0, 0, 0]],
      moves: [{ piece: 0, throwIndex: 0, destination: 10 }, { piece: 2, throwIndex: 0, destination: 4 }, { piece: 2, throwIndex: 1, destination: 2 }],
    });
    expect(screen.getByLabelText("나온 윷 결과")).toHaveTextContent("윷개");
    const moves = within(screen.getByRole("list", { name: "옮길 수 있는 말" })).getAllByRole("button");
    expect(moves.map((button) => button.textContent)).toEqual([
      "윷: 6번 칸 말(2개 업힘) → 10번 칸", "윷: 새 말 → 4번 칸", "개: 새 말 → 2번 칸",
    ]);
    expect(screen.queryByRole("button", { name: "윷 던지기" })).not.toBeInTheDocument();
    fireEvent.click(moves[2]!);
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "MOVE", numbers: [2, 1] });
  });

  it("상대 차례에는 버튼 없이 기다린다", () => {
    openYutnori({ turnSeat: 1, phase: "MOVE", pendingThrows: ["GEOL"] });
    expect(screen.getByText("영희 님 차례 (말 옮기는 중)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "윷 던지기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "옮길 수 있는 말" })).not.toBeInTheDocument();
  });
});

describe("온라인 캐치마인드", () => {
  const catchMindRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    ...twoPlayers,
    gameType: "CATCH_MIND", gameTypeLabel: "캐치마인드",
    game: {
      mySeat: 0, phase: "DRAWING", drawerSeat: 0, turnNumber: 1, totalTurns: 4, word: "사과", wordLength: 2,
      strokes: [{ color: 1, width: 8, points: [10, 10, 200, 200] }], scores: [0, 0], active: [true, true],
      guesses: [], log: ["캐치마인드 시작!"], winnerSeats: [], finished: false, ...game,
    },
  });
  // jsdom에는 Canvas 그리기가 없다. 그림은 그리지 않고 "무엇을 보내는지"만 확인한다
  let canvasSpy: { mockRestore: () => void } | null = null;
  beforeEach(() => {
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => canvasSpy?.mockRestore());
  const openCatchMind = (game: Record<string, unknown>) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: catchMindRoom(game) });
    return socket;
  };

  it("출제자는 제시어를 보고, 그린 선과 되돌리기·넘기기를 보낸다", () => {
    const socket = openCatchMind({});
    expect(screen.getByLabelText("제시어")).toHaveTextContent("제시어: 사과");
    expect(screen.queryByLabelText("정답")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "빨강" }));
    expect(screen.getByRole("button", { name: "빨강" })).toHaveAttribute("aria-pressed", "true");

    // jsdom의 그림판 크기는 0이라 모든 점이 (0, 0)이 된다. 손을 떼면 콕 찍은 점 하나를 보낸다
    const canvas = screen.getByRole("img", { name: /그림판/ });
    fireEvent.pointerDown(canvas, { pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "DRAW", numbers: [1, 8, 0, 0] });

    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "UNDO" });
    fireEvent.click(screen.getByRole("button", { name: "넘기기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "PASS" });
  });

  it("다른 사람은 글자 수 힌트를 보고 정답을 보낸다", () => {
    const socket = openCatchMind({ drawerSeat: 1, word: null, guesses: ["영희: 배"] });
    expect(screen.getByText(/영희 님이 그리는 중 · 정답: ○○ \(2글자\)/)).toBeInTheDocument();
    expect(screen.queryByLabelText("제시어")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "펜 색" })).not.toBeInTheDocument();

    const sentBefore = socket.sent.length;
    fireEvent.pointerDown(screen.getByRole("img", { name: "출제자의 그림" }), { pointerId: 1 });
    expect(socket.sent).toHaveLength(sentBefore); // 출제자가 아니면 그려도 보내지 않는다

    const submit = screen.getByRole("button", { name: "맞히기" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("정답"), { target: { value: " 사과 " } });
    fireEvent.click(submit);
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "GUESS", text: "사과" });
    expect(screen.getByLabelText("정답")).toHaveValue("");
    expect(screen.getByRole("list", { name: "틀린 답" })).toHaveTextContent("영희: 배");
  });

  it("마감 시각이 오면 남은 시간을 보여 주고, 10초 이하면 강조한다", () => {
    openCatchMind({ turnDeadline: Date.now() + 45_000 });
    expect(screen.getByRole("timer", { name: /남은 시간 (44|45)초/ })).not.toHaveClass("urgent");
    cleanup();
    openCatchMind({ turnDeadline: Date.now() + 5_000 });
    expect(screen.getByRole("timer", { name: /남은 시간 [45]초/ })).toHaveClass("urgent");
  });

  it("끝나면 승자와 점수를 보여 준다", () => {
    openCatchMind({ phase: "END", finished: true, word: null, scores: [15, 10], winnerSeats: [0] });
    expect(screen.getByText(/철수 승리!/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "점수" })).toHaveTextContent("15점");
    expect(screen.queryByRole("button", { name: "맞히기" })).not.toBeInTheDocument();
  });
});

describe("온라인 올림픽", () => {
  const player = (extra: Record<string, unknown> = {}) =>({ active: true, submitted: false, ready: false, progress: null, gold: 0, silver: 0, bronze: 0, ...extra });
  const olympicRoom = (game: Record<string, unknown>): OnlineRoom => ({
    ...baseRoom,
    gameType: "OLYMPIC", gameTypeLabel: "올림픽", status: "PLAYING", seats: ["p1", "p2"],
    participants: [
      { participantId: "p1", nickname: "철수", member: false, seatIndex: 0 },
      { participantId: "p2", nickname: "영희", member: false, seatIndex: 1 },
    ],
    game: { mySeat: 0, phase: "SELECT", events: [], eventIndex: 0, currentEvent: null, players: [player(), player()], results: [], winners: [], finished: false, ...game },
  });
  // jsdom에는 Canvas 그리기가 없으므로 경기장은 그리지 않는다(흐름만 확인)
  let canvasSpy: { mockRestore: () => void } | null = null;
  beforeEach(() => {
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => canvasSpy?.mockRestore());
  const openOlympic = (game: Record<string, unknown>) => {
    renderRoom();
    const socket = latestSocket();
    socket.serverOpen();
    socket.serverSend({ type: "ROOM_STATE", room: olympicRoom(game) });
    return socket;
  };

  it("1번 선수가 종목을 골라 개막하면 SELECT를 보낸다", () => {
    const socket = openOlympic({});
    expect(screen.getByRole("group", { name: /종목 고르기 \(6개\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "달리기만" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /높이뛰기/ }));
    fireEvent.click(screen.getByRole("button", { name: "3개 종목으로 개막" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "SELECT", numbers: [0, 1, 5] });
  });

  it("경기 중에는 내 경기 화면과 조작 버튼, 기록을 낸 뒤에는 다른 선수 진행을 보여 준다", () => {
    const socket = openOlympic({ phase: "EVENT", events: ["SPRINT_100"], currentEvent: "SPRINT_100" });
    expect(screen.getByRole("img", { name: "100m 달리기 경기 화면" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /왼발/ })).toBeInTheDocument();
    socket.serverSend({ type: "ROOM_STATE", room: olympicRoom({ phase: "EVENT", events: ["SPRINT_100"], currentEvent: "SPRINT_100", players: [player({ submitted: true, progress: 10_000 }), player({ progress: 4_200 })] }) });
    const status = screen.getByRole("list", { name: "경기 상황" });
    expect(within(status).getByText("기록 제출")).toBeInTheDocument();
    expect(within(status).getByText("경기 중…")).toBeInTheDocument();
  });

  it("종목이 끝나면 기록·메달을 보여 주고 다음 종목으로 NEXT를 보낸다", () => {
    const socket = openOlympic({
      phase: "RESULT", events: ["SPRINT_100", "LONG_JUMP"], currentEvent: "SPRINT_100",
      players: [player({ gold: 1 }), player({ silver: 1 })],
      results: [{ event: "SPRINT_100", marks: [10_530, null], medals: ["GOLD", null] }],
    });
    const table = screen.getByRole("table", { name: "100m 달리기 결과" });
    expect(within(table).getByText("10.53초")).toBeInTheDocument();
    expect(within(table).getByText("기록 없음")).toBeInTheDocument();
    expect(within(table).getByText("🥇 금")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 종목: 멀리뛰기" }));
    expect(socket.sent.at(-1)).toEqual({ type: "GAME_ACTION", action: "NEXT" });
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
      { roomId: "aaaa2222", title: "누구나 방", gameType: "OMOK", gameTypeLabel: "오목", gameOptionLabel: null, seatCount: 2, playerCount: 1, participantCount: 3, maxParticipants: 10, status: "WAITING", hasPassword: true, membersOnly: false, hostNickname: "철수" },
      { roomId: "bbbb3333", title: "회원 방", gameType: "GAME_2048", gameTypeLabel: "2048 대전", gameOptionLabel: "목표 512", seatCount: 2, playerCount: 2, participantCount: 2, maxParticipants: 10, status: "PLAYING", hasPassword: false, membersOnly: true, hostNickname: "영희" },
    ]);
    renderLobby();
    expect(await screen.findByRole("link", { name: "누구나 방 방 들어가기" })).toHaveAttribute("href", "/games/online/aaaa2222");
    expect(screen.getByText("🔒 비밀번호")).toBeInTheDocument();
    expect(screen.getByText("로그인 필요")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "회원 방 방 들어가기" })).not.toBeInTheDocument();
    expect(screen.getByText(/2048 대전\(목표 512\) · 플레이어 2\/2/)).toBeInTheDocument();
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
    expect(vi.mocked(createOnlineRoom).mock.calls[0]?.[0]).toEqual({ title: "오목 한 판", gameType: "OMOK", seatCount: 2, password: "1234", membersOnly: false, gameOption: null });
  });

  it("게임 목록은 혼자 연습할 수 있는 게임을 위에, 대전 전용 게임을 아래에 묶어 보여 준다", async () => {
    vi.mocked(getOnlineRooms).mockResolvedValue([]);
    renderLobby();
    const openButton = await screen.findByRole("button", { name: "새 방 만들기" });
    await waitFor(() => expect(openButton).toBeEnabled());
    fireEvent.click(openButton);
    const groups = within(screen.getByLabelText("게임")).getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("label"))).toEqual(["혼자 연습 가능", "대전 전용"]);
    expect(within(groups[0]!).getAllByRole("option").map((option) => option.textContent)).toEqual(["2048 대전"]);
    expect(within(groups[1]!).getAllByRole("option").map((option) => option.textContent)).toEqual(["오목", "체스 (준비 중)"]);
  });

  it("옵션이 있는 게임을 고르면 게임 옵션을 골라 방을 만든다", async () => {
    vi.mocked(getOnlineRooms).mockResolvedValue([]);
    vi.mocked(createOnlineRoom).mockResolvedValue({ roomId: "dddd5555", hostToken: "token" });
    renderLobby();
    const openButton = await screen.findByRole("button", { name: "새 방 만들기" });
    await waitFor(() => expect(openButton).toBeEnabled());
    fireEvent.click(openButton);
    fireEvent.change(screen.getByLabelText("방 제목"), { target: { value: "2048 한 판" } });
    fireEvent.change(screen.getByLabelText("게임"), { target: { value: "GAME_2048" } });
    expect(screen.getByLabelText("게임 옵션")).toHaveValue("512");
    fireEvent.change(screen.getByLabelText("게임 옵션"), { target: { value: "256" } });
    fireEvent.change(screen.getByLabelText("플레이어 수"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "만들고 들어가기" }));
    expect(await screen.findByText("방 화면")).toBeInTheDocument();
    expect(vi.mocked(createOnlineRoom).mock.calls[0]?.[0]).toEqual({ title: "2048 한 판", gameType: "GAME_2048", seatCount: 3, password: "", membersOnly: false, gameOption: "256" });
  });
});
