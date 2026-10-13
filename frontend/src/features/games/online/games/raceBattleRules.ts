// raceBattleRules.ts — 각자 자기 판으로 겨루는 대전(2048 대전·지뢰 찾기 대전)이 함께 쓰는 진행 상태 모양
//
// 성공·실패·순위는 서버(RaceStandings.java)만 정한다. 화면은 받은 상태를 이름표에 보여 주기만 한다.
import { z } from "zod";

/** PLAYING 진행 중 · SUCCESS 목표 달성 · FAILED 더 못 함(지뢰) · LEFT 기권·나감 */
export const raceStatusSchema = z.enum(["PLAYING", "SUCCESS", "FAILED", "LEFT"]);
export type RaceStatus = z.infer<typeof raceStatusSchema>;

export const raceStatusLabels: Record<RaceStatus, string> = { PLAYING: "진행 중", SUCCESS: "성공", FAILED: "실패", LEFT: "빠짐" };

/** 두 게임의 자리 정보에 공통으로 들어 있는 칸. rank는 끝난 뒤에만 온다 */
export const racePlayerFields = {
  nickname: z.string(),
  status: raceStatusSchema,
  finishOrder: z.number().int().nullish(),
  rank: z.number().int().nullish(),
};

/** 이름표 오른쪽 글자: 끝났으면 "N위", 아니면 상태 */
export const raceBadgeText = (status: RaceStatus, rank: number | null | undefined): string =>
  rank != null ? `${rank}위 · ${raceStatusLabels[status]}` : raceStatusLabels[status];
