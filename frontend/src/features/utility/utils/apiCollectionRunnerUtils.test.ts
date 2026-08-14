import { describe, expect, it } from "vitest";
import {
  calculateNextDailyRun,
  parseStoredCollectionRuns,
  parseStoredCollectionSchedules,
} from "@/features/utility/utils/apiCollectionRunnerUtils";

describe("Collection Runner 예약 계산", () => {
  it("오늘 실행 시각이 남아 있으면 오늘 시각을 반환한다", () => {
    const now = new Date(2026, 7, 14, 1, 30, 0);
    const nextRun = new Date(calculateNextDailyRun("02:00", now));

    expect(nextRun.getFullYear()).toBe(2026);
    expect(nextRun.getMonth()).toBe(7);
    expect(nextRun.getDate()).toBe(14);
    expect(nextRun.getHours()).toBe(2);
    expect(nextRun.getMinutes()).toBe(0);
  });

  it("오늘 실행 시각이 지났으면 다음 날로 넘긴다", () => {
    const now = new Date(2026, 7, 14, 2, 1, 0);
    const nextRun = new Date(calculateNextDailyRun("02:00", now));

    expect(nextRun.getDate()).toBe(15);
    expect(nextRun.getHours()).toBe(2);
  });

  it("잘못된 예약 시각을 거부한다", () => {
    expect(() => calculateNextDailyRun("25:00")).toThrow("HH:mm");
  });
});

describe("Collection Runner 저장 데이터 경계", () => {
  it("형식이 깨진 예약과 실행 이력을 제외한다", () => {
    const validSchedule = {
      id: "schedule-1",
      name: "매일 점검",
      collectionId: "collection-1",
      selectedRequestIds: ["request-1"],
      localTime: "02:00",
      iterationCount: 1,
      delayMilliseconds: 0,
      enabled: true,
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
      nextRunAt: "2026-08-15T02:00:00.000Z",
    };
    const validRun = {
      id: "run-1",
      collectionId: "collection-1",
      collectionName: "상태 점검",
      trigger: "MANUAL",
      status: "COMPLETED",
      startedAt: "2026-08-14T00:00:00.000Z",
      totalRequestCount: 1,
      completedRequestCount: 1,
      results: [],
    };

    expect(parseStoredCollectionSchedules(JSON.stringify([validSchedule, { id: 10 }]))).toEqual([validSchedule]);
    expect(parseStoredCollectionRuns(JSON.stringify([validRun, { status: "RUNNING" }]))).toEqual([validRun]);
  });
});
