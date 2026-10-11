// pokerRules.ts — 포커(텍사스 홀덤): 서버 화면 상태의 모양(zod)
import { z } from "zod";
import { playingCardSchema } from "@/features/games/online/games/playingCards";

export const pokerSchema = z.object({
  phase: z.enum(["BETTING", "FINISHED"]),
  handNumber: z.number().int(),
  maxHands: z.number().int(),
  street: z.string(),
  mySeat: z.number().int().nullish(),
  myCards: z.array(playingCardSchema),
  board: z.array(playingCardSchema),
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
  lastHand: z.object({
    cards: z.array(z.array(playingCardSchema)),
    handNames: z.array(z.string().nullable()),
    board: z.array(playingCardSchema),
    winners: z.array(z.number().int()),
    pot: z.number().int(),
  }).nullish(),
  winners: z.array(z.number().int()),
});

export type PokerView = z.infer<typeof pokerSchema>;
