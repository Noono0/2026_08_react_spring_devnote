/**
 * sudokuLogic.ts — 스도쿠 규칙과 문제 만들기 (화면과 분리한 순수 함수)
 *
 * [규칙] 9×9 판의 가로줄·세로줄·3×3 상자마다 1~9가 한 번씩 들어가야 한다.
 *
 * [문제 만들기 — 백트래킹(되추적)]
 *   1. 빈 판을 왼쪽 위부터 채운다. 넣을 수 있는 숫자를 섞어 하나씩 넣어 보고, 더 나아갈 수 없으면
 *      한 칸 되돌아가 다른 숫자를 넣는다. → 완성된 정답 판(숫자 순서를 섞으므로 매번 다른 판)
 *   2. 정답 판에서 칸을 무작위 순서로 지운다. 지운 뒤 답이 둘 이상이 되면 그 칸은 되돌린다.
 *      → 답이 하나뿐인 문제. 그래서 "겹침 없이 다 채운 판 = 정답 판"이다.
 *   서버의 SudokuGenerator.java(온라인 대전)와 같은 방법이다.
 *
 * ★ random을 인자로 받는다(shared/random.ts). 테스트는 createSeededRandom으로 언제나 같은 문제를 받는다.
 * ★ 판(SudokuGrid)을 바꾸지 않는다. 숫자를 넣을 때는 setCell로 새 판을 만든다(React State의 불변성).
 */
import { shuffle, type RandomSource } from "@/features/games/shared/random";

export const SUDOKU_SIZE = 9;
const BOX_SIZE = 3;
const CELL_COUNT = SUDOKU_SIZE * SUDOKU_SIZE;
export const SUDOKU_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** 9×9 숫자 판. 0은 빈 칸 */
export type SudokuGrid = number[][];

export interface Position {
  row: number;
  col: number;
}

export type SudokuDifficulty = "EASY" | "NORMAL" | "HARD";

/** 난이도 = 처음부터 놓인 숫자 수. 적을수록 어렵다. 이름은 서버 SoloGameCode.SUDOKU의 난이도 목록과 같아야 한다 */
export const sudokuDifficulties: Record<SudokuDifficulty, { label: string; givenCount: number }> = {
  EASY: { label: "쉬움", givenCount: 40 },
  NORMAL: { label: "보통", givenCount: 32 },
  HARD: { label: "어려움", givenCount: 26 },
};

export interface SudokuPuzzle {
  givens: SudokuGrid;
  solution: SudokuGrid;
}

/** 목표 숫자 수까지 못 지웠을 때 새 정답 판으로 다시 해 보는 횟수 */
const MAX_ATTEMPTS = 10;

export const createEmptyGrid = (): SudokuGrid => Array.from({ length: SUDOKU_SIZE }, () => Array.from({ length: SUDOKU_SIZE }, () => 0));

const copyGrid = (grid: SudokuGrid): SudokuGrid => grid.map((line) => [...line]);

export const valueAt = (grid: SudokuGrid, row: number, col: number): number => grid[row]?.[col] ?? 0;

/** (row, col)만 value로 바꾼 새 판. 원래 판은 그대로다 */
export const setCell = (grid: SudokuGrid, row: number, col: number, value: number): SudokuGrid =>
  grid.map((line, lineRow) => (lineRow === row ? line.map((current, lineCol) => (lineCol === col ? value : current)) : line));

export const countEmptyCells = (grid: SudokuGrid): number => grid.reduce((total, line) => total + line.filter((value) => value === 0).length, 0);

const countFilledCells = (grid: SudokuGrid): number => CELL_COUNT - countEmptyCells(grid);

/** 같은 가로줄·세로줄·3×3 상자에 있는 칸인가(자기 자신 포함) */
export const isPeer = (a: Position, b: Position): boolean =>
  a.row === b.row
  || a.col === b.col
  || (Math.floor(a.row / BOX_SIZE) === Math.floor(b.row / BOX_SIZE) && Math.floor(a.col / BOX_SIZE) === Math.floor(b.col / BOX_SIZE));

/** (row, col)에 value를 넣어도 규칙에 맞는가: 같은 가로줄·세로줄·3×3 상자의 "다른 칸"에 value가 없으면 true */
export const isValidPlacement = (grid: SudokuGrid, row: number, col: number, value: number): boolean => {
  for (let row2 = 0; row2 < SUDOKU_SIZE; row2 += 1) {
    for (let col2 = 0; col2 < SUDOKU_SIZE; col2 += 1) {
      const isSelf = row2 === row && col2 === col;
      if (!isSelf && isPeer({ row, col }, { row: row2, col: col2 }) && valueAt(grid, row2, col2) === value) return false;
    }
  }
  return true;
};

/** 칸마다 "같은 줄·상자에 같은 숫자가 또 있는가" */
export const findConflicts = (grid: SudokuGrid): boolean[][] =>
  grid.map((line, row) => line.map((value, col) => value !== 0 && !isValidPlacement(grid, row, col, value)));

/** 다 채웠고 겹치는 숫자가 없는가. 답이 하나뿐인 문제라면 이것이 곧 "정답 판과 같다"이다 */
export const isSudokuComplete = (grid: SudokuGrid): boolean =>
  countEmptyCells(grid) === 0 && findConflicts(grid).every((line) => line.every((conflict) => !conflict));

const candidatesAt = (grid: SudokuGrid, row: number, col: number): number[] =>
  SUDOKU_DIGITS.filter((digit) => isValidPlacement(grid, row, col, digit));

/** 완성된 정답 판 하나. 숫자를 넣는 순서를 섞어 매번 다른 판이 나온다 */
export const createSolvedGrid = (random: RandomSource): SudokuGrid => {
  const grid = createEmptyGrid();
  const fill = (cellIndex: number): boolean => {
    if (cellIndex === CELL_COUNT) return true;
    const row = Math.floor(cellIndex / SUDOKU_SIZE);
    const col = cellIndex % SUDOKU_SIZE;
    const line = grid[row];
    if (!line) return false;
    for (const digit of shuffle(candidatesAt(grid, row, col), random)) {
      line[col] = digit;
      if (fill(cellIndex + 1)) return true;
    }
    line[col] = 0; // 어떤 숫자도 안 되면 비우고 앞 칸으로 되돌아간다
    return false;
  };
  fill(0);
  return grid;
};

/**
 * 답의 개수를 limit개까지만 센다(limit=2면 "답이 하나뿐인가?"를 알 수 있다). grid는 바꾸지 않는다.
 * 넣을 수 있는 숫자가 가장 적은 빈 칸부터 채워 본다(MRV). 막다른 길을 일찍 알아차려 빠르다.
 * 이미 놓인 숫자끼리는 겹치지 않는다고 보고 빈 칸만 채운다(겹침 검사는 findConflicts).
 */
export const countSolutions = (grid: SudokuGrid, limit: number): number => {
  const work = copyGrid(grid);
  const search = (): number => {
    let best: { row: number; col: number; candidates: number[] } | null = null;
    for (let row = 0; row < SUDOKU_SIZE; row += 1) {
      for (let col = 0; col < SUDOKU_SIZE; col += 1) {
        if (valueAt(work, row, col) !== 0) continue;
        const candidates = candidatesAt(work, row, col);
        if (!best || candidates.length < best.candidates.length) best = { row, col, candidates };
        if (candidates.length <= 1) break; // 0개(막다른 길)나 1개면 더 찾을 필요가 없다
      }
      if (best && best.candidates.length <= 1) break;
    }
    if (!best) return 1; // 빈 칸이 없다 = 답 하나 완성
    const line = work[best.row];
    if (!line) return 0;
    let found = 0;
    for (const digit of best.candidates) {
      line[best.col] = digit;
      found += search();
      line[best.col] = 0; // 되돌리기
      if (found >= limit) break;
    }
    return found;
  };
  return search();
};

const removeCells = (solution: SudokuGrid, givenCount: number, random: RandomSource): SudokuGrid => {
  const givens = copyGrid(solution);
  let filled = CELL_COUNT;
  const cellIndexes = shuffle(Array.from({ length: CELL_COUNT }, (_, index) => index), random);
  for (const cellIndex of cellIndexes) {
    if (filled <= givenCount) break;
    const line = givens[Math.floor(cellIndex / SUDOKU_SIZE)];
    const col = cellIndex % SUDOKU_SIZE;
    if (!line) continue;
    const removed = line[col] ?? 0;
    line[col] = 0;
    if (countSolutions(givens, 2) === 1) filled -= 1;
    else line[col] = removed;
  }
  return givens;
};

/**
 * 난이도에 맞는 답이 하나뿐인 문제. 목표 숫자 수까지 못 지우면 새 정답 판으로 몇 번 더 해 보고
 * 가장 숫자가 적게 남은 문제를 돌려준다(그래서 아주 드물게 목표보다 숫자가 조금 많을 수 있다).
 */
export const generateSudoku = (difficulty: SudokuDifficulty, random: RandomSource): SudokuPuzzle => {
  const { givenCount } = sudokuDifficulties[difficulty];
  const attempt = (): SudokuPuzzle => {
    const solution = createSolvedGrid(random);
    return { givens: removeCells(solution, givenCount, random), solution };
  };
  let best = attempt();
  for (let count = 1; count < MAX_ATTEMPTS && countFilledCells(best.givens) > givenCount; count += 1) {
    const next = attempt();
    if (countFilledCells(next.givens) < countFilledCells(best.givens)) best = next;
  }
  return best;
};
