// appleBattleRules.ts — 사과게임 대전: 서버가 보내는 화면 상태의 모양(zod)과 판 변환
import { z } from "zod";
import { APPLE_COLUMNS, APPLE_ROWS, type AppleBoard } from "@/features/games/apple/appleLogic";

export const appleBattleSchema = z.object({
  mySeat: z.number().int().nullish(),
  /** 내 판: 10줄 × 17글자(1~9, 없앤 자리 '0'). 관전자는 빈 목록 */
  myBoard: z.array(z.string().regex(new RegExp(`^[0-9]{${APPLE_COLUMNS}}$`))),
  scores: z.array(z.number().int()),
  /** 자리마다 남은 사과 수(남의 판 모양은 오지 않는다) */
  remaining: z.array(z.number().int()),
  active: z.array(z.boolean()),
  /** 마감 시각(epoch ms). 시작 직후 1초 정도는 아직 없을 수 있다 */
  deadline: z.number().int().nullish(),
  log: z.array(z.string()),
  winnerSeats: z.array(z.number().int()),
  finished: z.boolean(),
});

export type AppleBattleView = z.infer<typeof appleBattleSchema>;

/** 서버의 글자 줄 → 숫자 판(appleLogic·AppleBoardView가 쓰는 모양). 줄 수가 맞지 않으면 null */
export const toAppleBoard = (rows: string[]): AppleBoard | null =>
  rows.length === APPLE_ROWS ? rows.map((row) => Array.from(row, (character) => Number(character))) : null;
