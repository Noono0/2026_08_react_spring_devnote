/**
 * rankingGames.ts — 랭킹을 보여 줄 종목 목록
 *
 * id는 주소(?game=solo:TETRIS)에 쓰는 값이다. 주소는 누구나 고쳐 칠 수 있으므로 findRankingGame으로 목록에 있는지 확인한다.
 * 온라인 대전 code는 서버 OnlineGameType, 혼자 하는 게임 code는 서버 SoloGameCode와 같아야 한다.
 */
import { memoryDifficulties, type MemoryDifficulty } from "@/features/games/memory/memoryLogic";
import { minesweeperDifficulties, type MinesweeperDifficulty } from "@/features/games/minesweeper/minesweeperLogic";
import { sudokuDifficulties, type SudokuDifficulty } from "@/features/games/sudoku/sudokuLogic";
import type { SoloGameCode } from "./rankingTypes";

export interface RankingDifficulty {
  value: string;
  label: string;
}

/** 혼자 하는 게임의 "좋은 기록" 기준. 서버 SoloGameCode.RankingOrder와 같다 */
export type SoloRankingMetric = "SCORE" | "TIME" | "MOVES_THEN_TIME";

export interface SoloRankingGame {
  kind: "SOLO";
  id: string;
  code: SoloGameCode;
  label: string;
  /** 이 게임을 하러 가는 화면 주소 */
  playRoute: string;
  metric: SoloRankingMetric;
  difficulties: RankingDifficulty[];
}

export interface OnlineRankingGame {
  kind: "ONLINE";
  id: string;
  code: string;
  label: string;
  playRoute: string;
}

export type RankingGame = SoloRankingGame | OnlineRankingGame;

const minesweeperOrder: MinesweeperDifficulty[] = ["BEGINNER", "INTERMEDIATE", "EXPERT"];
const memoryOrder: MemoryDifficulty[] = ["EASY", "NORMAL", "HARD"];
const sudokuOrder: SudokuDifficulty[] = ["EASY", "NORMAL", "HARD"];

// 혼자 하는 게임 화면은 없앴다. 하러 가기는 온라인 대전 대기실로 안내하고, 기록은 방 대기 중 연습에서 올린다.
export const soloRankingGames: SoloRankingGame[] = [
  { kind: "SOLO", id: "solo:GAME_2048", code: "GAME_2048", label: "2048", playRoute: "/games/online", metric: "SCORE", difficulties: [] },
  { kind: "SOLO", id: "solo:TETRIS", code: "TETRIS", label: "테트리스", playRoute: "/games/online", metric: "SCORE", difficulties: [] },
  { kind: "SOLO", id: "solo:PUYO", code: "PUYO", label: "뿌요뿌요", playRoute: "/games/online", metric: "SCORE", difficulties: [] },
  {
    kind: "SOLO", id: "solo:MINESWEEPER", code: "MINESWEEPER", label: "지뢰 찾기", playRoute: "/games/online", metric: "TIME",
    difficulties: minesweeperOrder.map((value) => ({ value, label: minesweeperDifficulties[value].label })),
  },
  {
    kind: "SOLO", id: "solo:MEMORY", code: "MEMORY", label: "카드 짝 맞추기", playRoute: "/games/online", metric: "MOVES_THEN_TIME",
    difficulties: memoryOrder.map((value) => ({ value, label: memoryDifficulties[value].label })),
  },
  {
    kind: "SOLO", id: "solo:SUDOKU", code: "SUDOKU", label: "스도쿠", playRoute: "/games/online", metric: "TIME",
    difficulties: sudokuOrder.map((value) => ({ value, label: sudokuDifficulties[value].label })),
  },
];

const onlineGame = (code: string, label: string): OnlineRankingGame =>
  ({ kind: "ONLINE", id: `online:${code}`, code, label, playRoute: "/games/online" });

const omokRankingGame = onlineGame("OMOK", "오목");

export const onlineRankingGames: OnlineRankingGame[] = [
  omokRankingGame,
  onlineGame("TETRIS", "테트리스 대전"),
  onlineGame("PUYO", "뿌요뿌요 대전"),
  onlineGame("CHESS", "체스"),
  onlineGame("BATTLESHIP", "배틀십"),
  onlineGame("NUMBER_BASEBALL", "숫자 야구"),
  onlineGame("ONE_CARD", "원카드"),
  onlineGame("MAFIA", "마피아"),
  onlineGame("MEMORY_MATCH", "카드 짝 맞추기 대전"),
  onlineGame("BLACKJACK", "블랙잭"),
  onlineGame("SUTDA", "섯다"),
  onlineGame("POKER", "포커"),
  onlineGame("SUDOKU", "스도쿠"),
  onlineGame("GAME_2048", "2048 대전"),
  onlineGame("MINESWEEPER", "지뢰 찾기 대전"),
  onlineGame("BILLIARDS", "당구"),
  onlineGame("OLYMPIC", "올림픽"),
  onlineGame("YUTNORI", "윷놀이"),
  onlineGame("CATCH_MIND", "캐치마인드"),
  onlineGame("JANGGI", "장기"),
  onlineGame("ALKKAGI", "알까기"),
];

export const defaultRankingGame: RankingGame = omokRankingGame;

/** 주소의 ?game= 값으로 종목을 찾는다. 목록에 없는 값이면 null */
export const findRankingGame = (gameId: string | null): RankingGame | null =>
  [...soloRankingGames, ...onlineRankingGames].find((game) => game.id === gameId) ?? null;
