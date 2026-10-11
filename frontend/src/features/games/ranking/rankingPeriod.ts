/**
 * rankingPeriod.ts — 랭킹 기간 버튼(이번 주·이번 달·전체)과 날짜 문자열 다루기
 *
 * 날짜는 "yyyy-MM-dd" 문자열로 다룬다. <input type="date">의 값과 서버 쿼리(from·to)가 같은 모양이라 바꿀 일이 없다.
 * ★ date.toISOString()은 UTC 기준이라 한국 시간 0~9시에는 하루 전 날짜가 나온다. 그래서 지역 시간으로 직접 만든다.
 */
import type { RankingPeriod } from "./rankingTypes";

export type RankingPeriodPreset = "WEEK" | "MONTH" | "ALL";

export const rankingPeriodPresets: { value: RankingPeriodPreset; label: string }[] = [
  { value: "WEEK", label: "이번 주" },
  { value: "MONTH", label: "이번 달" },
  { value: "ALL", label: "전체" },
];

const pad = (value: number) => String(value).padStart(2, "0");

export const formatLocalDate = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * 버튼 하나에 해당하는 기간.
 *   이번 주: 월요일 ~ 일요일 (getDay()는 일요일이 0이라 월요일까지 거슬러 갈 날 수를 따로 계산한다)
 *   이번 달: 1일 ~ 말일 (다음 달 0일 = 이번 달 마지막 날)
 */
export const periodForPreset = (preset: RankingPeriodPreset, today: Date = new Date()): RankingPeriod => {
  if (preset === "ALL") return { from: null, to: null };
  if (preset === "MONTH") {
    return {
      from: formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { from: formatLocalDate(monday), to: formatLocalDate(sunday) };
};

/** 지금 기간이 어느 버튼과 같은지(직접 고른 날짜면 null) */
export const matchingPreset = (period: RankingPeriod, today: Date = new Date()): RankingPeriodPreset | null =>
  rankingPeriodPresets.find(({ value }) => {
    const presetPeriod = periodForPreset(value, today);
    return presetPeriod.from === period.from && presetPeriod.to === period.to;
  })?.value ?? null;

/** "yyyy-MM-dd"는 글자 순서 = 날짜 순서라 문자열로 비교할 수 있다 */
export const isPeriodOrdered = (period: RankingPeriod): boolean =>
  period.from === null || period.to === null || period.from <= period.to;
