import type { ApiCollectionRun, ApiCollectionRunRequestResult, ApiCollectionSchedule } from "@/features/utility/types/apiWorkspaceTypes";

// apiCollectionRunnerUtils.ts — 컬렉션 실행기(여러 요청 차례로 실행)의 예약·실행 기록 도우미. 실행 기록은 최근 30건만 보관한다.
export const API_COLLECTION_RUN_HISTORY_LIMIT = 30;

const dailyTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "매일 HH:mm" 예약의 다음 실행 시각. 오늘 그 시각이 이미 지났으면 내일로 넘긴다(브라우저 현지 시간 기준).
export const calculateNextDailyRun = (localTime: string, fromDate = new Date()): string => {
  const timeMatch = dailyTimePattern.exec(localTime);
  if (!timeMatch) throw new Error("예약 시간은 HH:mm 형식이어야 합니다.");

  const nextRun = new Date(fromDate);
  nextRun.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  if (nextRun.getTime() <= fromDate.getTime()) nextRun.setDate(nextRun.getDate() + 1);
  return nextRun.toISOString();
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// 아래 isValid… 함수들은 localStorage에서 읽은 값이 정말 예약·실행 기록 모양인지 하나하나 확인하는 타입 가드다.
const isValidSchedule = (value: unknown): value is ApiCollectionSchedule => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.collectionId === "string"
    && Array.isArray(value.selectedRequestIds)
    && value.selectedRequestIds.every((requestId) => typeof requestId === "string")
    && typeof value.localTime === "string"
    && dailyTimePattern.test(value.localTime)
    && typeof value.iterationCount === "number"
    && Number.isInteger(value.iterationCount)
    && value.iterationCount >= 1
    && value.iterationCount <= 10
    && typeof value.delayMilliseconds === "number"
    && Number.isFinite(value.delayMilliseconds)
    && value.delayMilliseconds >= 0
    && value.delayMilliseconds <= 10_000
    && typeof value.enabled === "boolean"
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string"
    && typeof value.nextRunAt === "string"
    && Number.isFinite(Date.parse(value.nextRunAt));
};

const runnerMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

const isValidRunResult = (value: unknown): value is ApiCollectionRunRequestResult => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.savedRequestId === "string"
    && typeof value.requestName === "string"
    && typeof value.method === "string"
    && runnerMethods.has(value.method)
    && typeof value.iteration === "number"
    && Number.isInteger(value.iteration)
    && value.iteration >= 1
    && typeof value.responseTimeMilliseconds === "number"
    && Number.isFinite(value.responseTimeMilliseconds)
    && typeof value.successful === "boolean";
};

const isValidRun = (value: unknown): value is ApiCollectionRun => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.collectionId === "string"
    && typeof value.collectionName === "string"
    && (value.trigger === "MANUAL" || value.trigger === "SCHEDULED")
    && (value.status === "COMPLETED" || value.status === "CANCELLED")
    && typeof value.startedAt === "string"
    && typeof value.totalRequestCount === "number"
    && typeof value.completedRequestCount === "number"
    && Array.isArray(value.results)
    && value.results.every(isValidRunResult);
};

// 저장된 예약·기록 읽기. 깨진 JSON은 빈 목록, 모양이 틀린 항목은 버린다.
export const parseStoredCollectionSchedules = (storedValue: string | null): ApiCollectionSchedule[] => {
  if (!storedValue) return [];
  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    return Array.isArray(parsedValue) ? parsedValue.filter(isValidSchedule) : [];
  } catch {
    return [];
  }
};

export const parseStoredCollectionRuns = (storedValue: string | null): ApiCollectionRun[] => {
  if (!storedValue) return [];
  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    return Array.isArray(parsedValue) ? parsedValue.filter(isValidRun).slice(0, API_COLLECTION_RUN_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
};
