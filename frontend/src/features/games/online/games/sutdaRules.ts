// sutdaRules.ts — 섯다: 서버 화면 상태의 모양(zod)과 화투 카드 이름 풀이
import { z } from "zod";

/** 화투 코드: 월(1~10) + G(광)·Y(열끗)·A(특수)·B(보통). 예: "3G" 3월 광, "7Y" 7월 열끗 */
const hwatuSchema = z.string().regex(/^(?:[1-9]|10)[GYAB]$/);

export const sutdaSchema = z.object({
  phase: z.enum(["BETTING", "FINISHED"]),
  round: z.number().int(),
  maxRounds: z.number().int(),
  mySeat: z.number().int().nullish(),
  myCards: z.array(hwatuSchema),
  chips: z.array(z.number().int()),
  inHand: z.array(z.boolean()),
  active: z.array(z.boolean()),
  pot: z.number().int(),
  currentBet: z.number().int(),
  contributed: z.array(z.number().int()),
  toCall: z.number().int(),
  minRaise: z.number().int(),
  maxRaise: z.number().int(),
  turnSeat: z.number().int().nullish(),
  dealerSeat: z.number().int(),
  lastRound: z.object({
    cards: z.array(z.array(hwatuSchema)),
    handNames: z.array(z.string().nullable()),
    winners: z.array(z.number().int()),
    pot: z.number().int(),
    replay: z.boolean(),
  }).nullish(),
  winners: z.array(z.number().int()),
});

export type SutdaView = z.infer<typeof sutdaSchema>;

const MONTH_NAMES = ["", "송학", "매조", "벚꽃", "흑싸리", "난초", "모란", "홍싸리", "공산", "국진", "단풍"];

export const describeHwatu = (code: string) => {
  const month = Number(code.slice(0, -1));
  const kind = code.slice(-1);
  const kindLabel = kind === "G" ? "광" : kind === "Y" ? "열끗" : "";
  return { month, kind, kindLabel, name: `${month}월 ${MONTH_NAMES[month] ?? ""}${kindLabel ? ` ${kindLabel}` : ""}` };
};
