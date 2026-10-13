// olympicRules.ts — 올림픽 대전: 서버가 보내는 화면 상태의 모양(zod)
import { z } from "zod";
import { olympicEventIds } from "@/features/games/olympic/olympicEvents";

const eventIdSchema = z.enum(olympicEventIds);
const medalSchema = z.enum(["GOLD", "SILVER", "BRONZE"]);

export const olympicSchema = z.object({
  mySeat: z.number().int().nullish(),
  phase: z.enum(["SELECT", "EVENT", "RESULT", "END"]),
  /** 1번 선수가 고른 종목(고르기 전에는 빈 목록) */
  events: z.array(eventIdSchema),
  eventIndex: z.number().int().min(0),
  currentEvent: eventIdSchema.nullish(),
  players: z.array(z.object({
    active: z.boolean(),
    submitted: z.boolean(),
    ready: z.boolean(),
    /** 달리기 종목에서 달린 거리(cm) */
    progress: z.number().int().nullish(),
    gold: z.number().int(),
    silver: z.number().int(),
    bronze: z.number().int(),
  })),
  /** 끝난 종목마다 자리별 기록(null = 기록 없음)과 메달 */
  results: z.array(z.object({ event: eventIdSchema, marks: z.array(z.number().int().nullable()), medals: z.array(medalSchema.nullable()) })),
  winners: z.array(z.number().int()),
  finished: z.boolean(),
});

export type OlympicView = z.infer<typeof olympicSchema>;

export const SEAT_COLORS = ["#e03131", "#1c7ed6", "#2f9e44", "#f08c00"] as const;
