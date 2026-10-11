// numberBaseballRules.ts — 숫자 야구: 서버가 보내는 화면 상태의 모양(zod)과 입력 검사
import { z } from "zod";

const pitchSchema = z.object({
  round: z.number().int(), seat: z.number().int(), targetSeat: z.number().int(), guess: z.string(), strikes: z.number().int(), balls: z.number().int(),
});

export const numberBaseballSchema = z.object({
  phase: z.enum(["SETUP", "PLAY", "FINISHED"]),
  digits: z.number().int(),
  mySeat: z.number().int().nullish(),
  mySecret: z.string().nullish(),
  secretReady: z.array(z.boolean()),
  active: z.array(z.boolean()),
  turnSeat: z.number().int().nullish(),
  targetSeat: z.number().int().nullish(),
  round: z.number().int(),
  history: z.array(pitchSchema),
  winners: z.array(z.number().int()),
  secrets: z.array(z.string().nullable()).nullish(),
});

/** 서로 다른 숫자 3개(0~9) */
export const isValidBaseballNumber = (value: string): boolean => /^[0-9]{3}$/.test(value) && new Set(value).size === 3;

export type NumberBaseballView = z.infer<typeof numberBaseballSchema>;
