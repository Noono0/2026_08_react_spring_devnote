// oneCardRules.ts — 원카드: 서버 화면 상태의 모양(zod)과 "낼 수 있는 카드" 미리 보기(서버 OneCardGame.canPlay와 같은 규칙)
import { z } from "zod";
import { parseCard, playingCardSchema } from "@/features/games/online/games/playingCards";

export const oneCardSchema = z.object({
  mySeat: z.number().int().nullish(),
  myHand: z.array(playingCardSchema),
  handCounts: z.array(z.number().int()),
  top: playingCardSchema,
  currentSuit: z.string().nullish(),
  anyCard: z.boolean(),
  attackPenalty: z.number().int(),
  direction: z.number().int(),
  turnSeat: z.number().int().nullish(),
  drawPileCount: z.number().int(),
  active: z.array(z.boolean()),
  ranks: z.array(z.number().int()),
  finished: z.boolean(),
});

export type OneCardView = z.infer<typeof oneCardSchema>;

const attackValue = (code: string): number => {
  const card = parseCard(code);
  if (card.joker) return code === "BJ" ? 5 : 7;
  return card.rank === 1 ? 3 : card.rank === 2 ? 2 : 0;
};

/**
 * 이 카드를 지금 낼 수 있는지(화면에서 낼 수 없는 카드를 흐리게 보여 주는 용도).
 * 최종 판단은 서버가 한다 — 화면 규칙이 틀려도 서버가 거절하므로 규칙이 깨지지 않는다.
 */
export const canPlayCard = (code: string, view: OneCardView): boolean => {
  const card = parseCard(code);
  const top = parseCard(view.top.code);
  const matches = card.joker || view.anyCard || card.suit === view.currentSuit || (!top.joker && card.rank === top.rank);
  if (view.attackPenalty > 0) return attackValue(code) > 0 && matches;
  return matches;
};
