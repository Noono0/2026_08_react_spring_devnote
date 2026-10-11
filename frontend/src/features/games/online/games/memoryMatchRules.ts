// memoryMatchRules.ts — 카드 짝 맞추기 대전: 서버가 보내는 화면 상태의 모양(zod)
import { z } from "zod";

export const memoryMatchSchema = z.object({
  mySeat: z.number().int().nullish(),
  columns: z.number().int().min(1).max(8),
  /** symbol은 앞면(뒤집힘·맞춤·끝남)일 때만 온다. 뒷면 카드는 그림을 모른다 */
  cards: z.array(z.object({ symbol: z.string().nullish(), matchedBy: z.number().int().nullish(), faceUp: z.boolean() })),
  turnSeat: z.number().int().nullish(),
  scores: z.array(z.number().int()),
  active: z.array(z.boolean()),
  winners: z.array(z.number().int()),
  finished: z.boolean(),
});

export type MemoryMatchView = z.infer<typeof memoryMatchSchema>;
