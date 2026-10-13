// minesweeperBattleRules.ts — 지뢰 찾기 대전: 서버가 보내는 화면 상태의 모양(zod)과 칸 글자 풀이
//
// 지뢰 배치는 서버(MinesweeperGame.java)만 안다. 게임 중에는 판 글자에 지뢰가 아예 없고("." 닫힘, "F" 깃발, "0"~"8" 연 칸),
// 끝난 뒤에만 "*" 지뢰, "X" 밟은 지뢰, "W" 지뢰가 아닌 곳의 깃발이 더해진다. 그래서 화면 코드를 들여다봐도 지뢰를 알 수 없다.
import { z } from "zod";
import { racePlayerFields } from "@/features/games/online/games/raceBattleRules";

export const minesweeperBattleSchema = z.object({
  mySeat: z.number().int().nullish(),
  difficulty: z.string(),
  rows: z.number().int().min(1).max(30),
  cols: z.number().int().min(1).max(30),
  mines: z.number().int().min(1),
  safeCells: z.number().int().min(1),
  players: z.array(z.object({
    ...racePlayerFields,
    board: z.array(z.string().regex(/^[.F0-8*XW]+$/)),
    clicks: z.number().int().min(0),
    revealed: z.number().int().min(0),
    flags: z.number().int().min(0),
  })),
  winners: z.array(z.number().int()),
  finished: z.boolean(),
}).refine(
  (view) => view.players.every((player) => player.board.length === view.rows && player.board.every((line) => line.length === view.cols)),
  "판 크기가 rows·cols와 다릅니다.",
);

export type MinesweeperBattleView = z.infer<typeof minesweeperBattleSchema>;
export type MinesweeperBattlePlayer = MinesweeperBattleView["players"][number];

/** 판 글자 하나 = 칸 하나. 없는 칸은 닫힌 칸으로 본다 */
export const cellAt = (board: string[], row: number, col: number): string => board[row]?.[col] ?? ".";

export const isNumberCell = (cell: string): boolean => cell >= "1" && cell <= "8";
export const isRevealedCell = (cell: string): boolean => cell >= "0" && cell <= "8";

export const cellText = (cell: string): string => {
  if (cell === "F") return "🚩";
  if (cell === "W") return "❌";
  if (cell === "*" || cell === "X") return "💣";
  return isNumberCell(cell) ? cell : "";
};

/** 화면 낭독기용 칸 설명 */
export const cellLabel = (cell: string, row: number, col: number): string => {
  const position = `${row + 1}행 ${col + 1}열`;
  if (cell === "F") return `${position}, 깃발`;
  if (cell === "W") return `${position}, 틀린 깃발`;
  if (cell === "*") return `${position}, 지뢰`;
  if (cell === "X") return `${position}, 밟은 지뢰`;
  if (cell === "0") return `${position}, 빈 칸`;
  return isNumberCell(cell) ? `${position}, 주변 지뢰 ${cell}개` : `${position}, 닫힘`;
};

export const arrowOffsets: Record<string, { row: number; col: number }> = {
  ArrowUp: { row: -1, col: 0 }, ArrowDown: { row: 1, col: 0 }, ArrowLeft: { row: 0, col: -1 }, ArrowRight: { row: 0, col: 1 },
};
