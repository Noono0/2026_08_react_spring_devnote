// battleshipRules.ts — 배틀십: 서버가 보내는 화면 상태의 모양(zod)
import { z } from "zod";

/** 판 한 줄 = 10글자. "." 바다·모름, "S" 배, "o" 빗나감, "X" 명중, "#" 격침 */
const rowSchema = z.string().regex(/^[.SoX#]{10}$/);

export const battleshipSchema = z.object({
  phase: z.enum(["PLACE", "PLAY", "FINISHED"]),
  size: z.number().int(),
  shipLengths: z.array(z.number().int()),
  mySeat: z.number().int().nullish(),
  ready: z.array(z.boolean()),
  turnSeat: z.number().int().nullish(),
  winnerSeat: z.number().int().nullish(),
  shotsFired: z.number().int(),
  boards: z.array(z.object({ seat: z.number().int(), rows: z.array(rowSchema).length(10), shipsLeft: z.number().int() })).length(2),
});

export type BattleshipView = z.infer<typeof battleshipSchema>;

export const BATTLESHIP_CELL_LABELS: Record<string, string> = { ".": "바다", S: "내 배", o: "빗나감", X: "명중", "#": "격침된 배" };
