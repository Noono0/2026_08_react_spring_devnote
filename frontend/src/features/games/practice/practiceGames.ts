/**
 * practiceGames.ts — 온라인 대전 방에서 "기다리는 동안 혼자 연습"할 수 있는 게임과 처음 옵션
 *
 * 방 게임 종류(서버 OnlineGameType 코드) → 혼자 연습. 혼자 해도 의미가 있는 게임만 둔다.
 *   오목·체스·배틀십·숫자 야구·원카드·마피아·섯다·포커는 상대가 있어야 하는 게임이라 뺐고,
 *   블랙잭은 딜러 규칙이 서버(BlackjackGame.java)에만 있어 뺐다.
 *   알까기는 물리 계산을 브라우저용으로도 만들어(alkkagiPhysics.ts) 과녁 백 알을 떨어뜨리는 연습을 넣었다.
 *   사과게임(appleLogic.ts)·수박게임(suikaLogic.ts)은 원래 혼자 하는 게임이라 연습과 혼자 하는 게임 랭킹에 함께 올린다.
 *   (윷놀이·캐치마인드·장기는 상대가 있어야 하는 게임이라 연습이 없다)
 *
 * 방장이 고른 게임 옵션(난이도·목표 타일)은 서버가 보낸 문자열이다. 아는 값일 때만 쓰고, 아니면 서버의 처음 값과 같은 기본값을 쓴다.
 */
import type { MinesweeperDifficulty } from "@/features/games/minesweeper/minesweeperLogic";
import { parseColorCount, type ColorCount } from "@/features/games/puyo/puyoLogic";
import type { SudokuDifficulty } from "@/features/games/sudoku/sudokuLogic";

export const practiceGameTypes = ["TETRIS", "PUYO", "MEMORY_MATCH", "GAME_2048", "MINESWEEPER", "SUDOKU", "OLYMPIC", "ALKKAGI", "APPLE", "SUIKA"] as const;
export type PracticeGameType = (typeof practiceGameTypes)[number];

export const practiceGameLabels: Record<PracticeGameType, string> = {
  TETRIS: "테트리스",
  PUYO: "뿌요뿌요",
  MEMORY_MATCH: "카드 짝 맞추기",
  GAME_2048: "2048",
  MINESWEEPER: "지뢰 찾기",
  SUDOKU: "스도쿠",
  OLYMPIC: "올림픽",
  ALKKAGI: "알까기",
  APPLE: "사과게임",
  SUIKA: "수박게임",
};

export const isPracticeGameType = (gameType: string): gameType is PracticeGameType =>
  practiceGameTypes.some((practiceGameType) => practiceGameType === gameType);

const minesweeperOptions: readonly MinesweeperDifficulty[] = ["BEGINNER", "INTERMEDIATE", "EXPERT"];
const sudokuOptions: readonly SudokuDifficulty[] = ["EASY", "NORMAL", "HARD"];
/** 2048 대전의 목표 타일(서버 OnlineGameType.GAME_2048 옵션과 같다) */
export const GAME_2048_TARGETS = [256, 512, 1024, 2048] as const;

export const toMinesweeperDifficulty = (option: string | null | undefined): MinesweeperDifficulty =>
  minesweeperOptions.find((difficulty) => difficulty === option) ?? "BEGINNER";

export const toSudokuDifficulty = (option: string | null | undefined): SudokuDifficulty =>
  sudokuOptions.find((difficulty) => difficulty === option) ?? "NORMAL";

export const to2048Target = (option: string | null | undefined): number =>
  GAME_2048_TARGETS.find((target) => String(target) === option) ?? 512;

export const toPuyoColorCount = (option: string | null | undefined): ColorCount => parseColorCount(option);
