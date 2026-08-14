import type { PollStatus } from "@/features/utility/types/pollTypes";

export const MAXIMUM_POLL_OPTION_COUNT = 10;
export const MAXIMUM_POLL_DURATION_MINUTES = 60;

export const pollStatusLabels: Record<PollStatus, string> = {
  OPEN: "투표 중",
  CLOSED: "투표 종료",
  RESULTS_PUBLISHED: "투표 결과 공개",
};

export const calculatePollPercentage = (votes: number | null, participantCount: number): number => {
  if (votes === null || participantCount === 0) return 0;
  // 복수 선택 투표는 각 문항을 선택한 참여자의 비율이며, 모든 막대의 합이 100%일 필요는 없습니다.
  return Math.round(votes / participantCount * 100);
};

export const toDateTimeLocalValue = (date: Date): string => {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
};

export const createRelativeEndsAt = (minutes: number, now = new Date()): string =>
  new Date(now.getTime() + minutes * 60_000).toISOString();

export const createAbsoluteEndsAt = (dateTimeLocalValue: string): string | undefined => {
  const parsedDate = new Date(dateTimeLocalValue);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toISOString();
};
