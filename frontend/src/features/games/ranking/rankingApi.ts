// rankingApi.ts — 게임 랭킹 API(서버 GameRankingController와 1:1). 응답 ApiResponse에서 data만 꺼내 돌려준다.
// 온라인 대전 결과는 서버가 게임이 끝날 때 직접 저장하므로 등록 API가 없다.

import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { OnlineRankingEntry, RankingPeriod, SoloGameCode, SoloGameRecordRequest, SoloGameRecordSaved, SoloRankingEntry } from "./rankingTypes";

export const getOnlineRanking = async (gameType: string, period: RankingPeriod): Promise<OnlineRankingEntry[]> =>
  (await selectedHttpClient.get<ApiResponse<OnlineRankingEntry[]>>("/game-rankings/online", {
    queryParameters: { gameType, from: period.from, to: period.to },
  })).data;

export const getSoloRanking = async (gameCode: SoloGameCode, difficulty: string, period: RankingPeriod): Promise<SoloRankingEntry[]> =>
  (await selectedHttpClient.get<ApiResponse<SoloRankingEntry[]>>("/game-rankings/solo", {
    queryParameters: { gameCode, difficulty, from: period.from, to: period.to },
  })).data;

export const recordSoloGame = async (request: SoloGameRecordRequest): Promise<SoloGameRecordSaved> =>
  (await selectedHttpClient.post<SoloGameRecordRequest, ApiResponse<SoloGameRecordSaved>>("/game-rankings/solo", request)).data;
