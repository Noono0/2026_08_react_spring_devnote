// blackjackRules.ts — 블랙잭: 서버 화면 상태의 모양(zod)
import { z } from "zod";
import { playingCardSchema } from "@/features/games/online/games/playingCards";

export const blackjackSchema = z.object({
  phase: z.enum(["BETTING", "PLAYING", "FINISHED"]),
  round: z.number().int(),
  maxRounds: z.number().int(),
  mySeat: z.number().int().nullish(),
  chips: z.array(z.number().int()),
  bets: z.array(z.number().int()),
  hands: z.array(z.array(playingCardSchema)),
  handValues: z.array(z.number().int()),
  done: z.array(z.boolean()),
  active: z.array(z.boolean()),
  /** 딜러 카드. 딜러 차례 전에는 두 번째 칸이 null(숨김) */
  dealerCards: z.array(playingCardSchema.nullable()),
  dealerValue: z.number().int().nullish(),
  dealerHidden: z.boolean(),
  turnSeat: z.number().int().nullish(),
  lastResults: z.array(z.object({ delta: z.number().int(), outcome: z.string() })),
  lastDealerCards: z.array(playingCardSchema),
  winners: z.array(z.number().int()),
});

export type BlackjackView = z.infer<typeof blackjackSchema>;

export const BLACKJACK_MIN_BET = 10;
export const BLACKJACK_BET_CHOICES = [10, 50, 100, 200, 500];
