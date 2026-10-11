// sudokuRules.ts — 스도쿠 대전: 서버가 보내는 화면 상태의 모양(zod)
//
// 채점(내 판 = 정답인가)은 서버(SudokuGame.java)만 한다. 화면은 "같은 줄·상자에 겹치는 숫자"만
// 스도쿠 규칙 함수(games/sudoku/sudokuLogic.ts)로 계산해 빨갛게 보여 준다. 겹침은 내 판만 보고 알 수 있어 정답을 몰라도 된다.
import { z } from "zod";
import { SUDOKU_SIZE, type SudokuGrid } from "@/features/games/sudoku/sudokuLogic";

/** 판 한 줄 = 9글자. 1~9는 숫자, "."은 빈 칸(서버 SudokuGame.rowsOf와 같다) */
const sudokuRowsSchema = z.array(z.string().regex(/^[1-9.]{9}$/)).length(SUDOKU_SIZE);

export const sudokuBattleSchema = z.object({
  mySeat: z.number().int().nullish(),
  /** 문제의 빈 칸 수(진행 막대의 최대값) */
  emptyCells: z.number().int().min(0).max(81),
  givens: sudokuRowsSchema,
  /** 내 판(고정 숫자 포함). 관전자에게는 오지 않는다 */
  myBoard: sudokuRowsSchema.nullish(),
  /** 자리마다 채운 칸 수만 온다(남의 판·맞았는지는 비공개) */
  players: z.array(z.object({ filled: z.number().int().min(0).max(81), active: z.boolean() })),
  winners: z.array(z.number().int()),
  finished: z.boolean(),
  /** 정답은 게임이 끝난 뒤에만 온다 */
  solution: sudokuRowsSchema.nullish(),
});

export type SudokuBattleView = z.infer<typeof sudokuBattleSchema>;

export const toSudokuGrid = (rows: string[]): SudokuGrid => rows.map((row) => [...row].map((character) => (character === "." ? 0 : Number(character))));
