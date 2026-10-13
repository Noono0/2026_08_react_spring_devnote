import { describe, expect, it } from "vitest";
import { createSeededRandom } from "@/features/games/shared/random";
import {
  countEmptyCells,
  countSolutions,
  createSolvedGrid,
  createSudokuState,
  findConflicts,
  generateSudoku,
  isPeer,
  isSudokuComplete,
  isValidPlacement,
  setCell,
  sudokuDifficulties,
  sudokuReducer,
  type SudokuDifficulty,
  type SudokuGrid,
} from "./sudokuLogic";

const toGrid = (rows: string[]): SudokuGrid => rows.map((row) => [...row].map((character) => (character === "." ? 0 : Number(character))));

const solvedRows = ["534678912", "672195348", "198342567", "859761423", "426853791", "713924856", "961537284", "287419635", "345286179"];
const solved = toGrid(solvedRows);
/** 정답 판에서 (0,2)=4, (0,3)=6 두 칸만 비운 판 */
const almostSolved = setCell(setCell(solved, 0, 2, 0), 0, 3, 0);

describe("스도쿠 규칙 함수", () => {
  it("같은 가로줄·세로줄·3×3 상자의 칸만 서로 영향을 준다", () => {
    expect(isPeer({ row: 0, col: 0 }, { row: 0, col: 8 })).toBe(true);
    expect(isPeer({ row: 0, col: 0 }, { row: 8, col: 0 })).toBe(true);
    expect(isPeer({ row: 0, col: 0 }, { row: 2, col: 2 })).toBe(true);
    expect(isPeer({ row: 0, col: 0 }, { row: 3, col: 3 })).toBe(false);
  });

  it("같은 줄·상자의 다른 칸에 같은 숫자가 없을 때만 넣을 수 있다", () => {
    expect(isValidPlacement(almostSolved, 0, 2, 4)).toBe(true);
    expect(isValidPlacement(almostSolved, 0, 2, 5)).toBe(false); // 같은 가로줄의 5
    expect(isValidPlacement(almostSolved, 0, 2, 8)).toBe(false); // 같은 상자·세로줄의 8
    expect(isValidPlacement(solved, 0, 0, 5)).toBe(true); // 자기 칸은 비교하지 않는다
  });

  it("겹치는 숫자는 양쪽 칸 모두 표시한다", () => {
    const conflicts = findConflicts(setCell(almostSolved, 0, 2, 5));
    expect(conflicts[0]?.[0]).toBe(true);
    expect(conflicts[0]?.[2]).toBe(true);
    expect(conflicts[0]?.[1]).toBe(false);
  });

  it("setCell은 원래 판을 바꾸지 않고 새 판을 만든다", () => {
    const next = setCell(almostSolved, 0, 2, 4);
    expect(almostSolved[0]?.[2]).toBe(0);
    expect(next[0]?.[2]).toBe(4);
    expect(next[1]).toBe(almostSolved[1]); // 바뀌지 않은 줄은 그대로 함께 쓴다
  });

  it("다 채우고 겹침이 없을 때만 완성이다", () => {
    expect(isSudokuComplete(solved)).toBe(true);
    expect(isSudokuComplete(almostSolved)).toBe(false); // 빈 칸이 있다
    expect(isSudokuComplete(setCell(setCell(almostSolved, 0, 2, 6), 0, 3, 4))).toBe(false); // 다 채웠지만 겹친다
    expect(countEmptyCells(almostSolved)).toBe(2);
  });

  it("답을 limit개까지만 센다", () => {
    expect(countSolutions(almostSolved, 2)).toBe(1);
    expect(countSolutions(solved, 2)).toBe(1);
    expect(countSolutions(toGrid(Array.from({ length: 9 }, () => ".........")), 2)).toBe(2); // 빈 판은 답이 아주 많다
    expect(countSolutions(setCell(almostSolved, 0, 2, 6), 2)).toBe(0); // (0,3)에 넣을 숫자가 없는 막다른 길
  });
});

describe("스도쿠 문제 만들기", () => {
  it("정답 판은 규칙을 모두 지킨다", () => {
    expect(isSudokuComplete(createSolvedGrid(createSeededRandom(1)))).toBe(true);
  });

  it.each(Object.keys(sudokuDifficulties) as SudokuDifficulty[])("%s: 목표 숫자 수만큼 놓이고 답이 하나뿐이며 정답과 어긋나지 않는다", (difficulty) => {
    const { givens, solution } = generateSudoku(difficulty, createSeededRandom(2026));
    expect(81 - countEmptyCells(givens)).toBe(sudokuDifficulties[difficulty].givenCount);
    expect(countSolutions(givens, 2)).toBe(1);
    expect(isSudokuComplete(solution)).toBe(true);
    givens.forEach((line, row) => line.forEach((value, col) => {
      if (value !== 0) expect(value).toBe(solution[row]?.[col]);
    }));
  });

  it("같은 시드면 같은 문제가 나온다", () => {
    expect(generateSudoku("NORMAL", createSeededRandom(7))).toEqual(generateSudoku("NORMAL", createSeededRandom(7)));
    expect(generateSudoku("NORMAL", createSeededRandom(7))).not.toEqual(generateSudoku("NORMAL", createSeededRandom(8)));
  });
});

describe("스도쿠 혼자 연습(리듀서)", () => {
  const start = () => createSudokuState("EASY", { givens: almostSolved, solution: solved });

  it("처음에는 시간이 흐르지 않고, 숫자를 넣으면 시작한다", () => {
    const ready = start();
    expect(sudokuReducer(ready, { type: "TICK" })).toBe(ready);
    const playing = sudokuReducer(ready, { type: "PLACE", row: 0, col: 2, value: 6 });
    expect(playing).toMatchObject({ status: "PLAYING" });
    expect(playing.values[0]?.[2]).toBe(6);
    expect(ready.values[0]?.[2]).toBe(0); // 원래 상태는 그대로
    expect(sudokuReducer(playing, { type: "TICK" }).elapsedSeconds).toBe(1);
  });

  it("고정 숫자 칸·1~9가 아닌 값·같은 값은 바꾸지 않고, 지우기는 내가 넣은 숫자만 지운다", () => {
    const ready = start();
    expect(sudokuReducer(ready, { type: "PLACE", row: 0, col: 0, value: 1 })).toBe(ready);
    expect(sudokuReducer(ready, { type: "PLACE", row: 0, col: 2, value: 10 })).toBe(ready);
    expect(sudokuReducer(ready, { type: "ERASE", row: 0, col: 0 })).toBe(ready);
    const placed = sudokuReducer(ready, { type: "PLACE", row: 0, col: 2, value: 6 });
    expect(sudokuReducer(placed, { type: "PLACE", row: 0, col: 2, value: 6 })).toBe(placed);
    expect(sudokuReducer(placed, { type: "ERASE", row: 0, col: 2 }).values[0]?.[2]).toBe(0);
  });

  it("겹침 없이 다 채우면 완성되고, 그 뒤에는 시간도 판도 멈춘다", () => {
    const wrongOrder = sudokuReducer(sudokuReducer(start(), { type: "PLACE", row: 0, col: 2, value: 6 }), { type: "PLACE", row: 0, col: 3, value: 4 });
    expect(wrongOrder.status).toBe("PLAYING"); // 다 채웠지만 겹친다
    const fixed = sudokuReducer(sudokuReducer(wrongOrder, { type: "PLACE", row: 0, col: 2, value: 4 }), { type: "PLACE", row: 0, col: 3, value: 6 });
    expect(fixed.status).toBe("WON");
    expect(sudokuReducer(fixed, { type: "TICK" })).toBe(fixed);
    expect(sudokuReducer(fixed, { type: "ERASE", row: 0, col: 2 })).toBe(fixed);
  });

  it("다시 시작하면 새 난이도의 문제로 처음 상태가 된다", () => {
    const puzzle = generateSudoku("HARD", createSeededRandom(3));
    const restarted = sudokuReducer({ ...start(), elapsedSeconds: 30, status: "PLAYING" }, { type: "RESTART", difficulty: "HARD", puzzle });
    expect(restarted).toEqual({ difficulty: "HARD", givens: puzzle.givens, values: puzzle.givens, status: "READY", elapsedSeconds: 0 });
  });
});
