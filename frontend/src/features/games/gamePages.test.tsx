/**
 * 게임 화면 테스트 — 규칙 자체는 *Logic.test.ts에서 확인하고, 여기서는 "화면에서 조작하면 규칙대로 보이는지"를 본다.
 *
 * Math.random을 0으로 고정하면 카드 섞기·새 타일 위치가 항상 같아져 화면 결과를 예측할 수 있다.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Game2048Page } from "@/features/games/game2048/Game2048Page";
import { createDeck, MISMATCH_REVEAL_MS, memoryDifficulties } from "@/features/games/memory/memoryLogic";
import { MemoryGamePage } from "@/features/games/memory/MemoryGamePage";
import { MinesweeperPage } from "@/features/games/minesweeper/MinesweeperPage";
import { GameHomePage } from "@/features/games/pages/GameHomePage";
import { TetrisPage } from "@/features/games/tetris/TetrisPage";

/** "점수" 같은 이름 옆의 값(dd) */
const statValue = (label: string): string => screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent ?? "";
const storedValue = (key: string): unknown => JSON.parse(localStorage.getItem(`devnote.games.${key}`) ?? "null");
const cardButton = (index: number): HTMLElement => screen.getByRole("button", { name: new RegExp(`^${index + 1}번 카드`) });

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("게임 홈", () => {
  it("게임 네 개로 가는 링크를 보여 준다", () => {
    render(<MemoryRouter><GameHomePage /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /카드 짝 맞추기/ })).toHaveAttribute("href", "/games/memory");
    expect(screen.getByRole("link", { name: /2048.*한 줄 밀기/ })).toHaveAttribute("href", "/games/2048");
    expect(screen.getByRole("link", { name: /지뢰 찾기/ })).toHaveAttribute("href", "/games/minesweeper");
    expect(screen.getByRole("link", { name: /테트리스/ })).toHaveAttribute("href", "/games/tetris");
  });
});

describe("카드 짝 맞추기 화면", () => {
  // Math.random이 0이면 섞기 결과가 항상 같다 → 같은 방법으로 만든 덱으로 카드 위치를 안다
  const easyDeck = createDeck(memoryDifficulties.EASY.pairCount, () => 0);

  const startEasy = () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<MemoryGamePage />);
    fireEvent.click(screen.getByRole("button", { name: memoryDifficulties.EASY.label }));
  };

  it("틀린 두 장은 잠시 보였다가 다시 뒷면이 된다", () => {
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

  it("모든 짝을 맞추면 승리하고 최고 기록을 브라우저에 저장한다", () => {
    startEasy();
    const symbols = [...new Set(easyDeck.map((card) => card.symbol))];
    for (const symbol of symbols) {
      easyDeck.forEach((card, index) => {
        if (card.symbol === symbol) fireEvent.click(cardButton(index));
      });
    }
    expect(screen.getByText(/모두 맞췄습니다! 6번 시도/)).toHaveTextContent("새 최고 기록");
    expect(statValue("최고 기록")).toBe("6번 · 0:00");
    expect(storedValue("memory.best")).toEqual({ EASY: { moves: 6, seconds: 0 } });
  });

  it("저장된 기록이 잘못된 모양이면 기록 없음으로 시작한다", () => {
    localStorage.setItem("devnote.games.memory.best", JSON.stringify({ NORMAL: { moves: "많이" } }));
    render(<MemoryGamePage />);
    expect(statValue("최고 기록")).toBe("없음");
  });
});

describe("2048 화면", () => {
  it("방향키로 밀면 같은 숫자가 합쳐져 점수가 오르고, 최고 점수를 저장한다", () => {
    // Math.random = 0 → 새 타일은 항상 첫 빈칸에 2 → 시작 판 첫 줄은 [2, 2, 0, 0]
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<Game2048Page />);
    const board = screen.getByRole("grid", { name: /2048 판/ });
    expect(board).toHaveFocus(); // 화면을 열면 바로 키보드로 할 수 있다
    const firstRow = () => within(board).getAllByRole("row")[0]?.textContent;
    expect(firstRow()).toBe("22");

    fireEvent.keyDown(board, { key: "ArrowLeft" });
    expect(firstRow()).toBe("42"); // 2+2=4, 새 타일 2가 첫 빈칸(두 번째 칸)에
    expect(statValue("점수")).toBe("4");
    expect(storedValue("2048.best")).toBe(4);

    fireEvent.keyDown(board, { key: "ArrowLeft" }); // 더 밀 수 없으면 그대로
    expect(firstRow()).toBe("42");
  });

  it("화면 방향 버튼도 같은 이동을 한다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<Game2048Page />);
    fireEvent.click(screen.getByRole("button", { name: "오른쪽으로 밀기" }));
    expect(statValue("점수")).toBe("4");
  });
});

describe("지뢰 찾기 화면", () => {
  it("오른쪽 클릭으로 깃발을 꽂으면 남은 지뢰 수가 줄고, 깃발 칸은 눌러도 열리지 않는다", () => {
    render(<MinesweeperPage />);
    const cell = screen.getByRole("button", { name: "1행 1열, 닫힘" });
    fireEvent.contextMenu(cell);
    expect(cell).toHaveAccessibleName("1행 1열, 깃발");
    expect(statValue("남은 지뢰")).toBe("9");
    fireEvent.click(cell);
    expect(cell).toHaveAccessibleName("1행 1열, 깃발");
  });

  it("첫 클릭은 안전하고 주변까지 열린다", () => {
    render(<MinesweeperPage />);
    fireEvent.click(screen.getByRole("button", { name: "5행 5열, 닫힘" }));
    expect(screen.getByRole("button", { name: /^5행 5열, 빈 칸$/ })).toBeInTheDocument(); // 첫 칸과 이웃엔 지뢰가 없어 0
    expect(screen.queryAllByRole("button", { name: /, 지뢰$/ })).toHaveLength(0);
  });

  it("방향키로 칸을 옮기고 F로 깃발, 깃발 모드에서는 눌러도 깃발을 꽂는다", () => {
    render(<MinesweeperPage />);
    const firstCell = screen.getByRole("button", { name: "1행 1열, 닫힘" });
    firstCell.focus();
    fireEvent.keyDown(firstCell, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "1행 2열, 닫힘" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement ?? firstCell, { key: "f" });
    expect(screen.getByRole("button", { name: "1행 2열, 깃발" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /깃발 모드/ }));
    fireEvent.click(screen.getByRole("button", { name: "9행 9열, 닫힘" }));
    expect(screen.getByRole("button", { name: "9행 9열, 깃발" })).toBeInTheDocument();
    expect(statValue("남은 지뢰")).toBe("8");
  });
});

describe("테트리스 화면", () => {
  it("시작 → Space로 바로 떨어뜨리면 점수가 오르고, P로 일시정지·계속한다", () => {
    render(<TetrisPage />);
    fireEvent.click(screen.getByRole("button", { name: "시작 (Enter)" }));
    const stage = screen.getByRole("application", { name: /테트리스 게임 영역/ });
    expect(stage).toHaveFocus();
    expect(statValue("점수")).toBe("0");

    fireEvent.keyDown(stage, { key: " " });
    expect(Number(statValue("점수"))).toBeGreaterThan(0); // 떨어진 칸 × 2점

    fireEvent.keyDown(stage, { key: "p" });
    expect(screen.getByText(/일시정지 —/)).toBeInTheDocument();
    fireEvent.keyDown(stage, { key: "p" });
    expect(screen.queryByText(/일시정지 —/)).not.toBeInTheDocument();
  });

  it("중력 타이머가 블록을 내리고, 포커스가 게임 밖으로 나가면 자동으로 일시정지한다", () => {
    vi.useFakeTimers();
    render(<TetrisPage />);
    fireEvent.click(screen.getByRole("button", { name: "시작 (Enter)" }));
    const stage = screen.getByRole("application", { name: /테트리스 게임 영역/ });
    const activeCells = () => stage.querySelectorAll(".tetris-board .tetris-cell[class*='piece-']:not(.ghost)").length;
    // 새 블록은 보이지 않는 숨은 줄 두 칸에서 나온다 → 처음에는 보이는 칸이 0개
    expect(activeCells()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(800 * 3); // 레벨 1은 0.8초마다 한 칸 → 세 칸 내려오면 네 칸 모두 보인다
    });
    expect(activeCells()).toBe(4);

    fireEvent.blur(stage, { relatedTarget: null });
    expect(screen.getByText(/일시정지 —/)).toBeInTheDocument();
  });
});
