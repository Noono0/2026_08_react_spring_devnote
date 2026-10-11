// rankingQueryKeys.ts — 랭킹 캐시 키. 조건(종목·난이도·기간)이 키에 들어 있어 조건마다 따로 캐시된다.
// 등록에 성공하면 all로 랭킹 캐시 전체를 무효화한다.
import type { RankingPeriod, SoloGameCode } from "./rankingTypes";

export const rankingQueryKeys = {
  all: ["game-rankings"] as const,
  online: (gameType: string, period: RankingPeriod) => ["game-rankings", "online", gameType, period.from, period.to] as const,
  solo: (gameCode: SoloGameCode, difficulty: string, period: RankingPeriod) =>
    ["game-rankings", "solo", gameCode, difficulty, period.from, period.to] as const,
};
