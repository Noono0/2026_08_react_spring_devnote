/**
 * olympicEvents.ts — 올림픽(육상 6종목) 종목 정보와 기록 표시
 *
 * 기록 단위: 달리기 종목은 밀리초(작을수록 좋음), 뛰기·던지기 종목은 센티미터(클수록 좋음).
 * 서버(OlympicGame.Event)와 같은 코드·범위를 쓴다. 기록 없음(실격·파울만 3번)은 null(서버로는 -1).
 */
export const olympicEventIds = ["SPRINT_100", "HURDLES_110", "LONG_JUMP", "JAVELIN", "HAMMER", "HIGH_JUMP"] as const;
export type OlympicEventId = (typeof olympicEventIds)[number];

export interface OlympicEventInfo {
  label: string;
  /** 시간 기록이면 true(작을수록 좋음) */
  timed: boolean;
  /** 화면에 보여 주는 세계 기록(분위기용) */
  worldRecord: string;
  /** 조작 설명 */
  howTo: string;
  attempts: number;
}

export const olympicEvents: Record<OlympicEventId, OlympicEventInfo> = {
  SPRINT_100: { label: "100m 달리기", timed: true, worldRecord: "9.58초", attempts: 1, howTo: "출발 신호 뒤 ←·→(또는 Z·X)를 번갈아 빠르게! 신호 전에 누르면 부정 출발(두 번이면 실격)." },
  HURDLES_110: { label: "110m 허들", timed: true, worldRecord: "12.80초", attempts: 1, howTo: "←·→ 번갈아 달리다 허들 앞에서 스페이스로 점프. 허들에 걸리면 크게 느려집니다." },
  LONG_JUMP: { label: "멀리뛰기", timed: false, worldRecord: "8.95m", attempts: 3, howTo: "←·→로 도움닫기, 발판(흰 선) 바로 앞에서 스페이스를 누른 채 각도를 올리고 떼면 점프. 약 20°가 좋습니다." },
  JAVELIN: { label: "창던지기", timed: false, worldRecord: "98.48m", attempts: 3, howTo: "←·→로 도움닫기, 파울 선 전에 스페이스를 누른 채 각도를 올리고 떼면 던집니다. 약 40°가 좋습니다." },
  HAMMER: { label: "해머던지기", timed: false, worldRecord: "86.74m", attempts: 3, howTo: "←·→ 번갈아 눌러 해머를 빠르게 돌리고, 해머가 앞(초록 부채꼴)을 향할 때 스페이스로 놓습니다. 10초 안에 놓아야 합니다." },
  HIGH_JUMP: { label: "높이뛰기", timed: false, worldRecord: "2.45m", attempts: 3, howTo: "←·→로 도움닫기, 발 구름 구역(노란 칸)에서 스페이스를 누른 채 각도를 올리고 떼면 점프. 한 높이에 3번 실패하면 끝." },
};

export type Medal = "GOLD" | "SILVER" | "BRONZE";

/** 혼자 할 때 메달 기준(서버 OlympicGame.Event의 기준과 같다). 시간 종목은 이하, 나머지는 이상 */
export const medalStandards: Record<OlympicEventId, Record<Medal, number>> = {
  SPRINT_100: { GOLD: 11000, SILVER: 12000, BRONZE: 13500 },
  HURDLES_110: { GOLD: 14500, SILVER: 16000, BRONZE: 18000 },
  LONG_JUMP: { GOLD: 720, SILVER: 650, BRONZE: 580 },
  JAVELIN: { GOLD: 8000, SILVER: 7000, BRONZE: 6000 },
  HAMMER: { GOLD: 7000, SILVER: 6000, BRONZE: 5000 },
  HIGH_JUMP: { GOLD: 205, SILVER: 195, BRONZE: 185 },
};

export const medalByStandard = (event: OlympicEventId, mark: number | null): Medal | null => {
  if (mark === null) return null;
  const standard = medalStandards[event];
  const meets = (limit: number) => (olympicEvents[event].timed ? mark <= limit : mark >= limit);
  return meets(standard.GOLD) ? "GOLD" : meets(standard.SILVER) ? "SILVER" : meets(standard.BRONZE) ? "BRONZE" : null;
};

export const medalLabel: Record<Medal, string> = { GOLD: "🥇 금", SILVER: "🥈 은", BRONZE: "🥉 동" };

export const isOlympicEventId =(value: string): value is OlympicEventId => olympicEventIds.some((id) => id === value);

/** 10530 → "10.53초", 745 → "7.45m", null → "기록 없음" */
export const formatMark = (event: OlympicEventId, mark: number | null): string => {
  if (mark === null) return "기록 없음";
  return olympicEvents[event].timed ? `${(mark / 1000).toFixed(2)}초` : `${(mark / 100).toFixed(2)}m`;
};

/** a가 b보다 좋은 기록인가(기록 없음은 항상 나쁨) */
export const isBetterMark = (event: OlympicEventId, a: number | null, b: number | null): boolean => {
  if (a === null) return false;
  if (b === null) return true;
  return olympicEvents[event].timed ? a < b : a > b;
};
