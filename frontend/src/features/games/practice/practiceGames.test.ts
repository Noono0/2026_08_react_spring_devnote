import { describe, expect, it } from "vitest";
import { isPracticeGameType, to2048Target, toMinesweeperDifficulty, toPuyoColorCount, toSudokuDifficulty } from "./practiceGames";

describe("혼자 연습할 수 있는 게임", () => {
  it("혼자 해도 의미가 있는 게임만 연습 대상으로 본다", () => {
    expect(isPracticeGameType("TETRIS")).toBe(true);
    expect(isPracticeGameType("PUYO")).toBe(true);
    expect(isPracticeGameType("MEMORY_MATCH")).toBe(true);
    expect(isPracticeGameType("GAME_2048")).toBe(true);
    expect(isPracticeGameType("MINESWEEPER")).toBe(true);
    expect(isPracticeGameType("SUDOKU")).toBe(true);
    expect(isPracticeGameType("ALKKAGI")).toBe(true);
    expect(isPracticeGameType("APPLE")).toBe(true);
    expect(isPracticeGameType("SUIKA")).toBe(true);
    expect(isPracticeGameType("JANGGI")).toBe(false);
    expect(isPracticeGameType("OMOK")).toBe(false);
    expect(isPracticeGameType("BLACKJACK")).toBe(false);
    expect(isPracticeGameType("MAFIA")).toBe(false);
  });

  it("방 옵션 문자열이 목록에 있을 때만 쓰고, 아니면 그 게임의 처음 값을 쓴다", () => {
    expect(to2048Target("1024")).toBe(1024);
    expect(to2048Target("99")).toBe(512);
    expect(to2048Target(null)).toBe(512);
    expect(toMinesweeperDifficulty("EXPERT")).toBe("EXPERT");
    expect(toMinesweeperDifficulty(undefined)).toBe("BEGINNER");
    expect(toSudokuDifficulty("HARD")).toBe("HARD");
    expect(toSudokuDifficulty("x")).toBe("NORMAL");
    expect(toPuyoColorCount("5")).toBe(5);
    expect(toPuyoColorCount("x")).toBe(4);
  });
});
