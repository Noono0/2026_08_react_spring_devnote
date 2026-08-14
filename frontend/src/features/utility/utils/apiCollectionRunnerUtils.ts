import type { ApiCollectionRun, ApiCollectionRunRequestResult, ApiCollectionSchedule } from "@/features/utility/types/apiWorkspaceTypes";

export const API_COLLECTION_RUN_HISTORY_LIMIT = 30;

const dailyTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const calculateNextDailyRun = (localTime: string, fromDate = new Date()): string => {
  const timeMatch = dailyTimePattern.exec(localTime);
  if (!timeMatch) throw new Error("예약 시간은 HH:mm 형식이어야 합니다.");

  const nextRun = new Date(fromDate);
  nextRun.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  if (nextRun.getTime() <= fromDate.getTime()) nextRun.setDate(nextRun.getDate() + 1);
  return nextRun.toISOString();
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

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
