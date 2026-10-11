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
