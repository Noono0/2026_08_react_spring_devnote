// suikaBattleRules.ts — 수박게임 대전: 서버가 보내는 화면 상태의 모양(zod)
import { z } from "zod";

export const suikaBattleSchema = z.object({
  mySeat: z.number().int().nullish(),
  /** 모두 같은 과일 순서를 받기 위한 시드(createSeededRandom에 넣는다) */
  seed: z.number().int().nonnegative(),
  scores: z.array(z.number().int()),
  /** 자리마다 상자가 넘쳐 끝났는지 */
  over: z.array(z.boolean()),
  active: z.array(z.boolean()),
  deadline: z.number().int().nullish(),
  log: z.array(z.string()),
  winnerSeats: z.array(z.number().int()),
  finished: z.boolean(),
});

export type SuikaBattleView = z.infer<typeof suikaBattleSchema>;
