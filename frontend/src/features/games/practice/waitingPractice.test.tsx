/**
 * 대기 중 혼자 연습 화면 테스트.
 * 규칙 자체는 *Logic.test.ts가 확인하고, 여기서는 "펼치면 판이 보이고, 조작하면 기록이 올라가나"를 본다.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDeck, MISMATCH_REVEAL_MS, memoryDifficulties } from "@/features/games/memory/memoryLogic";
import { recordSoloGame } from "@/features/games/ranking/rankingApi";
import { WaitingPracticePanel } from "./WaitingPracticePanel";

vi.mock("@/features/auth/hooks/useAuthSession", () => ({
  useAuthSessionQuery: () => ({ isPending: false, data: { authenticated: false, memberName: "회원" } }),
}));
vi.mock("@/features/games/ranking/rankingApi", () => ({ recordSoloGame: vi.fn() }));
const mockedRecordSoloGame = vi.mocked(recordSoloGame);

const renderPanel = (page: ReactElement) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{page}</MemoryRouter>
  </QueryClientProvider>,
);

const statValue = (label: string): string => screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent ?? "";
const storedValue = (key: string): unknown => JSON.parse(localStorage.getItem(`devnote.games.${key}`) ?? "null");
const cardButton = (index: number): HTMLElement => screen.getByRole("button", { name: new RegExp(`^${index + 1}번 카드`) });

beforeEach(() => {
  localStorage.clear();
  mockedRecordSoloGame.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("WaitingPracticePanel", () => {
  it("연습할 수 없는 게임이면 아무것도 그리지 않는다", () => {
    const { container } = renderPanel(<WaitingPracticePanel gameType="OMOK" gameOption={null} nickname="철수" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("연습하기를 누르면 테트리스 연습 판이 펼쳐지고, 접으면 사라진다", () => {
    renderPanel(<WaitingPracticePanel gameType="TETRIS" gameOption={null} nickname="철수" />);
    expect(screen.queryByRole("application", { name: /테트리스 연습 영역/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "테트리스 연습하기" }));
    expect(screen.getByRole("application", { name: /테트리스 연습 영역/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "연습 접기" }));
    expect(screen.queryByRole("application", { name: /테트리스 연습 영역/ })).not.toBeInTheDocument();
  });
});

describe("카드 짝 맞추기 연습", () => {
  const easyDeck = createDeck(memoryDifficulties.EASY.pairCount, () => 0);

  const startEasy = () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    renderPanel(<WaitingPracticePanel gameType="MEMORY_MATCH" gameOption={null} nickname="철수" />);
    fireEvent.click(screen.getByRole("button", { name: "카드 짝 맞추기 연습하기" }));
    fireEvent.click(screen.getByRole("button", { name: memoryDifficulties.EASY.label }));
  };

  const matchAllPairs = () => {
    const symbols = [...new Set(easyDeck.map((card) => card.symbol))];
    for (const symbol of symbols) {
      easyDeck.forEach((card, index) => {
        if (card.symbol === symbol) fireEvent.click(cardButton(index));
      });
    }
  };

  it("틀린 두 장은 잠시 보여 줬다가 다시 뒷면이 된다", () => {
    vi.useFakeTimers();
    startEasy();
    const first = easyDeck[0];
    const otherIndex = easyDeck.findIndex((card) => card.symbol !== first?.symbol);
    fireEvent.click(cardButton(0));
    fireEvent.click(cardButton(otherIndex));
    expect(cardButton(0)).toHaveAccessibleName(`1번 카드 ${first?.symbol ?? ""}`);
    expect(statValue("시도")).toBe("1");
    act(() => {
      vi.advanceTimersByTime(MISMATCH_REVEAL_MS);
    });
    expect(cardButton(0)).toHaveAccessibleName("1번 카드 (뒷면)");
  });

  it("모든 짝을 맞추면 이기고 연습 기록을 올릴 수 있다", async () => {
    mockedRecordSoloGame.mockResolvedValue({ soloGameRecordId: 1, playerName: "철수", member: false });
    startEasy();
    matchAllPairs();
    expect(screen.getByText(/모두 맞췄습니다! 6번 시도/)).toHaveTextContent("새 최고 기록");
    expect(statValue("최고 기록")).toBe("6번 · 0:00");
    expect(storedValue("memory.best")).toEqual({ EASY: { moves: 6, seconds: 0 } });

    const form = screen.getByRole("form", { name: "연습 기록 등록" });
    expect(within(form).getByRole("link", { name: /연습 기록 보기/ })).toHaveAttribute("href", "/games/rankings?game=solo%3AMEMORY&difficulty=EASY");
    expect(within(form).getByLabelText(/닉네임/)).toHaveValue("철수");
    fireEvent.click(within(form).getByRole("button", { name: "연습 기록 올리기" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("철수 이름으로 연습 기록을 올렸습니다."));
    expect(mockedRecordSoloGame.mock.calls[0]?.[0]).toEqual({ gameCode: "MEMORY", difficulty: "EASY", nickname: "철수", moves: 6, elapsedSeconds: 0 });
  });
});

describe("2048 연습", () => {
  it("방향키로 밀면 같은 숫자가 합쳐져 점수가 오르고, 목표 타일은 방 옵션을 따른다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    renderPanel(<WaitingPracticePanel gameType="GAME_2048" gameOption="256" nickname="철수" />);
    fireEvent.click(screen.getByRole("button", { name: "2048 연습하기" }));
    const board = screen.getByRole("grid", { name: /2048 연습 판/ });
    expect(statValue("목표")).toBe("256");
    expect(within(board).getAllByRole("row")[0]?.textContent).toBe("22");
    fireEvent.keyDown(board, { key: "ArrowLeft" });
    expect(within(board).getAllByRole("row")[0]?.textContent).toBe("42");
    expect(statValue("점수")).toBe("4");
    expect(storedValue("2048.best")).toBe(4);
  });
});

describe("지뢰 찾기 연습", () => {
  it("오른쪽 클릭으로 깃발을 꽂으면 남은 지뢰 수가 줄고, 깃발 칸은 눌러도 열리지 않는다", () => {
    renderPanel(<WaitingPracticePanel gameType="MINESWEEPER" gameOption="BEGINNER" nickname="철수" />);
    fireEvent.click(screen.getByRole("button", { name: "지뢰 찾기 연습하기" }));
    const cell = screen.getByRole("button", { name: "1행 1열, 닫힘" });
    fireEvent.contextMenu(cell);
    expect(cell).toHaveAccessibleName("1행 1열, 깃발");
    expect(statValue("남은 지뢰")).toBe("9");
    fireEvent.click(cell);
    expect(cell).toHaveAccessibleName("1행 1열, 깃발");
  });
});
