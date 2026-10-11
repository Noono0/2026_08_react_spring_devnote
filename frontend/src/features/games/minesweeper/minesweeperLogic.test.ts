import { describe, expect, it } from "vitest";
import {
  countAdjacentMines,
  countFlags,
  createEmptyBoard,
  createMinesweeperState,
  getNeighbors,
  isBetterTime,
  minesweeperReducer,
  placeMines,
  remainingMines,
  revealArea,
  type MineBoard,
  type MinesweeperState,
} from "./minesweeperLogic";

/** "*"는 지뢰, "."은 빈 칸인 글자 지도로 판을 만든다(주변 지뢰 수는 자동 계산). */
const boardFrom = (rows: string[]): MineBoard =>
  countAdjacentMines(rows.map((line) => [...line].map((character) => ({ mine: character === "*", adjacentMines: 0, state: "HIDDEN" as const }))));

/** 이미 지뢰가 놓인(진행 중인) 게임 상태 */
const playing = (rows: string[]): MinesweeperState => {
  const board = boardFrom(rows);
  const mineCount = board.flat().filter((cell) => cell.mine).length;
  return { ...createMinesweeperState("BEGINNER"), rows: board.length, cols: board[0]?.length ?? 0, mineCount, board, status: "PLAYING" };
};

/** 판을 글자 지도로: 열린 칸은 숫자(0은 " "), 깃발 F, 닫힌 칸 # */
const view = (board: MineBoard): string[] =>
  board.map((row) => row.map((cell) => (cell.state === "FLAGGED" ? "F" : cell.state === "HIDDEN" ? "#" : cell.mine ? "*" : cell.adjacentMines === 0 ? " " : String(cell.adjacentMines))).join(""));

describe("이웃·지뢰 수", () => {
  it("모서리는 3칸, 변은 5칸, 가운데는 8칸이 이웃이다", () => {
    expect(getNeighbors(3, 3, 0, 0)).toHaveLength(3);
    expect(getNeighbors(3, 3, 0, 1)).toHaveLength(5);
    expect(getNeighbors(3, 3, 1, 1)).toHaveLength(8);
  });

  it("주변 8칸의 지뢰를 센다", () => {
    const board = boardFrom(["*..", ".*.", "..."]);
    expect(board.map((row) => row.map((cell) => cell.adjacentMines))).toEqual([[1, 2, 1], [2, 1, 1], [1, 1, 1]]);
  });
});

describe("지뢰 놓기(첫 클릭은 안전)", () => {
  it("정확한 개수를 놓고, 첫 클릭 칸과 이웃은 피한다", () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const board = placeMines(createEmptyBoard(9, 9), 10, { row: 4, col: 4 }, seed);
      expect(board.flat().filter((cell) => cell.mine)).toHaveLength(10);
      const safeArea = [{ row: 4, col: 4 }, ...getNeighbors(9, 9, 4, 4)];
      expect(safeArea.every((position) => !board[position.row]?.[position.col]?.mine)).toBe(true);
    }
  });

  it("자리가 모자란 작은 판에서는 클릭한 칸만 피한다", () => {
    const board = placeMines(createEmptyBoard(3, 3), 8, { row: 1, col: 1 }, 1);
    expect(board[1]?.[1]?.mine).toBe(false);
    expect(board.flat().filter((cell) => cell.mine)).toHaveLength(8);
  });

  it("같은 시드면 같은 배치", () => {
    const layout = (seed: number) => view(placeMines(createEmptyBoard(9, 9), 10, { row: 0, col: 0 }, seed).map((row) => row.map((cell) => ({ ...cell, state: "REVEALED" as const }))));
    expect(layout(42)).toEqual(layout(42));
  });

  it("첫 클릭(READY)에 지뢰를 놓고 바로 그 칸부터 연다", () => {
    const state = minesweeperReducer(createMinesweeperState("BEGINNER"), { type: "REVEAL", row: 4, col: 4, seed: 123 });
    expect(state.status).toBe("PLAYING");
    expect(state.board.flat().filter((cell) => cell.mine)).toHaveLength(10);
    expect(state.board[4]?.[4]).toMatchObject({ state: "REVEALED", mine: false, adjacentMines: 0 });
  });
});

describe("빈 칸 연쇄 열기(revealArea)", () => {
  it("0인 칸에서 이웃으로 넓히고, 숫자 칸에서 멈춘다", () => {
    const board = boardFrom([
      "....",
      "....",
      "...*",
    ]);
    expect(view(revealArea(board, { row: 0, col: 0 }))).toEqual([
      "    ",
      "  11",
      "  1#",
    ]);
  });

  it("숫자 칸을 열면 그 칸만 열린다", () => {
    const board = boardFrom(["*..", "...", "..."]);
    expect(view(revealArea(board, { row: 1, col: 1 }))).toEqual(["###", "#1#", "###"]);
  });

  it("깃발 칸은 넓히는 중에도 열지 않는다", () => {
    const board = boardFrom(["...", "...", "..*"]);
    const flagged = board.map((row, rowIndex) => row.map((cell, colIndex) => (rowIndex === 0 && colIndex === 2 ? { ...cell, state: "FLAGGED" as const } : cell)));
    expect(view(revealArea(flagged, { row: 0, col: 0 }))[0]).toBe("  F");
  });

  it("원본 판을 바꾸지 않는다(불변성)", () => {
    const board = boardFrom(["...", "...", "..*"]);
    revealArea(board, { row: 0, col: 0 });
    expect(board.flat().every((cell) => cell.state === "HIDDEN")).toBe(true);
  });
});

describe("게임 진행(리듀서)", () => {
  it("지뢰를 열면 지고, 깃발 없는 지뢰가 모두 드러나며 밟은 위치를 기억한다", () => {
    const lost = minesweeperReducer(playing(["*.*", "...", "..."]), { type: "REVEAL", row: 0, col: 0, seed: 0 });
    expect(lost.status).toBe("LOST");
    expect(lost.explodedAt).toEqual({ row: 0, col: 0 });
    expect(lost.board[0]?.[2]?.state).toBe("REVEALED");
  });

  it("지뢰 아닌 칸을 모두 열면 이기고, 남은 지뢰에 깃발이 꽂힌다", () => {
    const won = minesweeperReducer(playing(["*..", "...", "..."]), { type: "REVEAL", row: 2, col: 2, seed: 0 });
    expect(won.status).toBe("WON");
    expect(won.board[0]?.[0]?.state).toBe("FLAGGED");
    expect(remainingMines(won)).toBe(0);
  });

  it("깃발: 닫힌 칸에만 꽂고 뺄 수 있고, 깃발 칸은 열리지 않는다", () => {
    let state = playing(["*..", "...", "..."]);
    state = minesweeperReducer(state, { type: "TOGGLE_FLAG", row: 0, col: 0 });
    expect(countFlags(state.board)).toBe(1);
    expect(minesweeperReducer(state, { type: "REVEAL", row: 0, col: 0, seed: 0 })).toBe(state);
    state = minesweeperReducer(state, { type: "TOGGLE_FLAG", row: 0, col: 0 });
    expect(countFlags(state.board)).toBe(0);
  });

  it("열린 숫자 칸을 누르면: 주변 깃발 수가 같을 때만 나머지 이웃을 연다(chord)", () => {
    let state = playing(["*...", "....", "....", "...."]);
    state = minesweeperReducer(state, { type: "REVEAL", row: 1, col: 1, seed: 0 }); // 숫자 1
    expect(minesweeperReducer(state, { type: "REVEAL", row: 1, col: 1, seed: 0 })).toBe(state); // 깃발 0개 ≠ 1 → 그대로
    state = minesweeperReducer(state, { type: "TOGGLE_FLAG", row: 0, col: 0 });
    const chorded = minesweeperReducer(state, { type: "REVEAL", row: 1, col: 1, seed: 0 });
    expect(chorded.status).toBe("WON"); // 나머지가 모두 열려 승리
  });

  it("깃발을 잘못 꽂고 chord하면 지뢰를 열어 진다", () => {
    let state = playing(["*...", "....", "....", "...."]);
    state = minesweeperReducer(state, { type: "REVEAL", row: 1, col: 1, seed: 0 });
    state = minesweeperReducer(state, { type: "TOGGLE_FLAG", row: 0, col: 1 }); // 틀린 깃발
    expect(minesweeperReducer(state, { type: "REVEAL", row: 1, col: 1, seed: 0 }).status).toBe("LOST");
  });

  it("끝난 게임은 더 바뀌지 않고, 시간은 진행 중에만 흐른다", () => {
    const lost = minesweeperReducer(playing(["*..", "...", "..."]), { type: "REVEAL", row: 0, col: 0, seed: 0 });
    expect(minesweeperReducer(lost, { type: "REVEAL", row: 2, col: 2, seed: 0 })).toBe(lost);
    expect(minesweeperReducer(lost, { type: "TOGGLE_FLAG", row: 2, col: 2 })).toBe(lost);
    expect(minesweeperReducer(lost, { type: "TICK" })).toBe(lost);
    expect(minesweeperReducer(playing(["*.."]), { type: "TICK" }).elapsedSeconds).toBe(1);
    expect(minesweeperReducer(createMinesweeperState("BEGINNER"), { type: "TICK" }).elapsedSeconds).toBe(0);
  });

  it("난이도별 크기와 지뢰 수로 다시 시작한다", () => {
    expect(minesweeperReducer(playing(["*.."]), { type: "RESTART", difficulty: "EXPERT" })).toMatchObject({ rows: 16, cols: 30, mineCount: 99, status: "READY", elapsedSeconds: 0 });
  });

  it("최고 기록은 짧을수록 좋다", () => {
    expect(isBetterTime(30, null)).toBe(true);
    expect(isBetterTime(29, 30)).toBe(true);
    expect(isBetterTime(30, 30)).toBe(false);
  });
});
