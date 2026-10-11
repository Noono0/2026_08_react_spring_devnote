/**
 * minesweeperLogic.ts — 지뢰찾기 게임 규칙 (화면과 분리한 순수 함수 + 리듀서)
 *
 * [규칙]
 *   - 칸을 열면 주변 8칸에 있는 지뢰 수가 보인다. 지뢰를 열면 진다.
 *   - 주변 지뢰가 0인 칸을 열면 이웃 칸이 연쇄로 열린다(빈 영역 넓히기 = flood fill).
 *   - 깃발로 지뢰라고 표시한 칸은 열리지 않는다.
 *   - 열린 숫자 칸을 다시 누르면, 주변 깃발 수가 그 숫자와 같을 때 나머지 이웃을 한꺼번에 연다(chord).
 *   - 지뢰가 아닌 칸을 모두 열면 이긴다.
 *   - 첫 클릭은 항상 안전하다: 지뢰를 첫 클릭 "뒤에", 그 칸과 이웃을 피해서 놓는다.
 *
 * [재귀 대신 큐(BFS)]
 *   빈 칸 연쇄 열기를 재귀 함수로 쓰면 큰 판(30×16)에서 호출이 너무 깊어질 수 있다.
 *   "열어야 할 칸 목록(큐)"에서 하나씩 꺼내 처리하는 반복문(너비 우선 탐색)으로 같은 일을 한다.
 *
 * ★ 리듀서는 순수해야 하므로 지뢰 배치에 쓸 무작위 시드를 REVEAL 동작에 담아 보낸다.
 */
import { createSeededRandom, shuffle } from "@/features/games/shared/random";

export type MinesweeperDifficulty = "BEGINNER" | "INTERMEDIATE" | "EXPERT";

export const minesweeperDifficulties: Record<MinesweeperDifficulty, { label: string; rows: number; cols: number; mines: number }> = {
  BEGINNER: { label: "초급 · 9×9 · 지뢰 10", rows: 9, cols: 9, mines: 10 },
  INTERMEDIATE: { label: "중급 · 16×16 · 지뢰 40", rows: 16, cols: 16, mines: 40 },
  EXPERT: { label: "고급 · 16×30 · 지뢰 99", rows: 16, cols: 30, mines: 99 },
};

export type CellState = "HIDDEN" | "REVEALED" | "FLAGGED";

export interface MineCell {
  mine: boolean;
  adjacentMines: number; // 주변 8칸의 지뢰 수
  state: CellState;
}

export type MineBoard = MineCell[][];
export type MinesweeperStatus = "READY" | "PLAYING" | "WON" | "LOST";

export interface Position {
  row: number;
  col: number;
}

export interface MinesweeperState {
  difficulty: MinesweeperDifficulty;
  rows: number;
  cols: number;
  mineCount: number;
  board: MineBoard;
  status: MinesweeperStatus;
  /** 진 경우 밟은 지뢰 위치(빨갛게 보여 준다) */
  explodedAt: Position | null;
  elapsedSeconds: number;
}

export type MinesweeperAction =
  | { type: "REVEAL"; row: number; col: number; seed: number } // seed: 첫 클릭 때 지뢰를 놓을 무작위 시드
  | { type: "TOGGLE_FLAG"; row: number; col: number }
  | { type: "TICK" }
  | { type: "RESTART"; difficulty: MinesweeperDifficulty };

export const MAX_ELAPSED_SECONDS = 999;

export const createEmptyBoard = (rows: number, cols: number): MineBoard =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, (): MineCell => ({ mine: false, adjacentMines: 0, state: "HIDDEN" })));

/** 판 안에 있는 이웃 칸(최대 8개) */
export const getNeighbors = (rows: number, cols: number, row: number, col: number): Position[] => {
  const neighbors: Position[] = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const neighborRow = row + rowOffset;
      const neighborCol = col + colOffset;
      if (neighborRow >= 0 && neighborRow < rows && neighborCol >= 0 && neighborCol < cols) neighbors.push({ row: neighborRow, col: neighborCol });
    }
  }
  return neighbors;
};

const cellAt = (board: MineBoard, position: Position): MineCell | undefined => board[position.row]?.[position.col];

/** 각 칸의 주변 지뢰 수를 다시 센다. */
export const countAdjacentMines = (board: MineBoard): MineBoard => {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  return board.map((row, rowIndex) =>
    row.map((cell, colIndex) => ({
      ...cell,
      adjacentMines: getNeighbors(rows, cols, rowIndex, colIndex).filter((neighbor) => cellAt(board, neighbor)?.mine).length,
    })),
  );
};

/**
 * 지뢰를 놓는다. safe 칸과 그 이웃은 피한다(첫 클릭이 빈 칸으로 넓게 열리도록).
 * 피할 칸을 빼면 자리가 모자란 작은 판에서는 safe 칸 하나만 피한다.
 */
export const placeMines = (board: MineBoard, mineCount: number, safe: Position, seed: number): MineBoard => {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const safeKeys = new Set([safe, ...getNeighbors(rows, cols, safe.row, safe.col)].map((position) => `${position.row}:${position.col}`));
  const allCells = board.flatMap((row, rowIndex) => row.map((_, colIndex) => ({ row: rowIndex, col: colIndex })));
  const roomy = allCells.filter((position) => !safeKeys.has(`${position.row}:${position.col}`));
  const candidates = roomy.length >= mineCount ? roomy : allCells.filter((position) => position.row !== safe.row || position.col !== safe.col);
  if (candidates.length < mineCount) throw new Error("지뢰 수가 칸 수보다 많습니다.");
  const mineKeys = new Set(shuffle(candidates, createSeededRandom(seed)).slice(0, mineCount).map((position) => `${position.row}:${position.col}`));
  return countAdjacentMines(board.map((row, rowIndex) => row.map((cell, colIndex) => ({ ...cell, mine: mineKeys.has(`${rowIndex}:${colIndex}`) }))));
};

/**
 * start 칸을 연다. 주변 지뢰가 0인 칸이면 이웃으로 계속 넓힌다(BFS). 깃발 칸·이미 연 칸·지뢰 칸은 넓히는 중에 열지 않는다.
 * 원본 판은 그대로 두고 새 판을 돌려준다.
 */
export const revealArea = (board: MineBoard, start: Position): MineBoard => {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const next = board.map((row) => row.map((cell) => ({ ...cell }))); // 한 번만 복사하고, 복사본을 고친다
  const startCell = cellAt(next, start);
  if (!startCell || startCell.state !== "HIDDEN") return board;

  const queue: Position[] = [start];
  startCell.state = "REVEALED";
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const currentCell = cellAt(next, current);
    if (!currentCell || currentCell.mine || currentCell.adjacentMines > 0) continue; // 숫자 칸에서는 더 넓히지 않는다
    for (const neighbor of getNeighbors(rows, cols, current.row, current.col)) {
      const neighborCell = cellAt(next, neighbor);
      if (!neighborCell || neighborCell.state !== "HIDDEN" || neighborCell.mine) continue;
      neighborCell.state = "REVEALED";
      queue.push(neighbor);
    }
  }
  return next;
};

const allSafeCellsRevealed = (board: MineBoard): boolean => board.every((row) => row.every((cell) => cell.mine || cell.state === "REVEALED"));

/** 이겼을 때: 남은 지뢰에 모두 깃발을 꽂아 보여 준다. */
const flagAllMines = (board: MineBoard): MineBoard => board.map((row) => row.map((cell) => (cell.mine ? { ...cell, state: "FLAGGED" } : cell)));

/** 졌을 때: 깃발 없는 지뢰를 모두 연다(틀린 깃발은 화면에서 따로 표시한다). */
const revealAllMines = (board: MineBoard): MineBoard => board.map((row) => row.map((cell) => (cell.mine && cell.state === "HIDDEN" ? { ...cell, state: "REVEALED" } : cell)));

export const createMinesweeperState = (difficulty: MinesweeperDifficulty): MinesweeperState => {
  const { rows, cols, mines } = minesweeperDifficulties[difficulty];
  return { difficulty, rows, cols, mineCount: mines, board: createEmptyBoard(rows, cols), status: "READY", explodedAt: null, elapsedSeconds: 0 };
};

export const countFlags = (board: MineBoard): number => board.reduce((total, row) => total + row.filter((cell) => cell.state === "FLAGGED").length, 0);

/** 남은 지뢰 수 표시(지뢰 수 - 깃발 수). 깃발을 너무 많이 꽂으면 음수가 될 수 있다. */
export const remainingMines = (state: MinesweeperState): number => state.mineCount - countFlags(state.board);

/** 칸들을 열고 결과(승리·패배)를 반영한다. 여러 칸을 한꺼번에 여는 chord에도 쓴다. */
const openCells = (state: MinesweeperState, board: MineBoard, targets: Position[]): MinesweeperState => {
  let nextBoard = board;
  for (const target of targets) {
    const cell = cellAt(nextBoard, target);
    if (!cell || cell.state !== "HIDDEN") continue;
    if (cell.mine) {
      return { ...state, board: revealAllMines(nextBoard), status: "LOST", explodedAt: target };
    }
    nextBoard = revealArea(nextBoard, target);
  }
  if (allSafeCellsRevealed(nextBoard)) return { ...state, board: flagAllMines(nextBoard), status: "WON" };
  return { ...state, board: nextBoard, status: "PLAYING" };
};

const reveal = (state: MinesweeperState, position: Position, seed: number): MinesweeperState => {
  if (state.status === "WON" || state.status === "LOST") return state;
  const cell = cellAt(state.board, position);
  if (!cell || cell.state === "FLAGGED") return state;

  // 첫 클릭: 이 칸을 피해 지뢰를 놓은 뒤 연다(첫 클릭은 언제나 안전).
  const board = state.status === "READY" ? placeMines(state.board, state.mineCount, position, seed) : state.board;

  if (cell.state === "REVEALED") {
    // 열린 숫자 칸: 주변 깃발 수가 숫자와 같으면 나머지 이웃을 연다(chord). 다르면 아무 일 없음.
    const neighbors = getNeighbors(state.rows, state.cols, position.row, position.col);
    const flagged = neighbors.filter((neighbor) => cellAt(board, neighbor)?.state === "FLAGGED").length;
    if (cell.adjacentMines === 0 || flagged !== cell.adjacentMines) return state;
    return openCells(state, board, neighbors);
  }
  return openCells(state, board, [position]);
};

const toggleFlag = (state: MinesweeperState, position: Position): MinesweeperState => {
  if (state.status === "WON" || state.status === "LOST") return state;
  const cell = cellAt(state.board, position);
  if (!cell || cell.state === "REVEALED") return state;
  const nextState: CellState = cell.state === "FLAGGED" ? "HIDDEN" : "FLAGGED";
  const board = state.board.map((row, rowIndex) =>
    rowIndex === position.row ? row.map((candidate, colIndex) => (colIndex === position.col ? { ...candidate, state: nextState } : candidate)) : row,
  );
  return { ...state, board };
};

export const minesweeperReducer = (state: MinesweeperState, action: MinesweeperAction): MinesweeperState => {
  switch (action.type) {
    case "REVEAL":
      return reveal(state, { row: action.row, col: action.col }, action.seed);
    case "TOGGLE_FLAG":
      return toggleFlag(state, { row: action.row, col: action.col });
    case "TICK":
      return state.status === "PLAYING" && state.elapsedSeconds < MAX_ELAPSED_SECONDS ? { ...state, elapsedSeconds: state.elapsedSeconds + 1 } : state;
    case "RESTART":
      return createMinesweeperState(action.difficulty);
  }
};

/** 최고 기록(초)은 짧을수록 좋다. */
export const isBetterTime = (seconds: number, best: number | null): boolean => best === null || seconds < best;

/** 실제 게임에서 REVEAL에 담을 시드 */
export const createRevealSeed = (): number => Math.floor(Math.random() * 2 ** 32);
