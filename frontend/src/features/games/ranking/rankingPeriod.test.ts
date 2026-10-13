import { describe, expect, it } from "vitest";
import { formatLocalDate, isPeriodOrdered, matchingPreset, periodForPreset } from "./rankingPeriod";

describe("rankingPeriod", () => {
  it("지역 시간 기준 yyyy-MM-dd로 만든다(한국 새벽에도 하루 전 날짜가 나오지 않는다)", () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
  });

  it("이번 주는 월요일부터 일요일까지다. 일요일에 눌러도 그 주 월요일부터", () => {
    expect(periodForPreset("WEEK", new Date(2026, 9, 14))).toEqual({ from: "2026-10-12", to: "2026-10-18" }); // 수요일
    expect(periodForPreset("WEEK", new Date(2026, 9, 18))).toEqual({ from: "2026-10-12", to: "2026-10-18" }); // 일요일
    expect(periodForPreset("WEEK", new Date(2026, 10, 1))).toEqual({ from: "2026-10-26", to: "2026-11-01" }); // 달을 걸친 주
  });

  it("이번 달은 1일부터 말일까지, 전체는 양쪽 끝이 없다", () => {
    expect(periodForPreset("MONTH", new Date(2028, 1, 10))).toEqual({ from: "2028-02-01", to: "2028-02-29" }); // 윤년 2월
    expect(periodForPreset("ALL")).toEqual({ from: null, to: null });
  });

  it("기간이 어느 버튼과 같은지 찾고, 직접 고른 날짜면 null", () => {
    const today = new Date(2026, 9, 11);
    expect(matchingPreset({ from: "2026-10-01", to: "2026-10-31" }, today)).toBe("MONTH");
    expect(matchingPreset({ from: null, to: null }, today)).toBe("ALL");
    expect(matchingPreset({ from: "2026-10-02", to: "2026-10-31" }, today)).toBeNull();
  });

  it("시작일이 종료일보다 늦으면 잘못된 기간이다(한쪽이 비어 있으면 괜찮다)", () => {
    expect(isPeriodOrdered({ from: "2026-10-02", to: "2026-10-01" })).toBe(false);
    expect(isPeriodOrdered({ from: "2026-10-01", to: "2026-10-01" })).toBe(true);
    expect(isPeriodOrdered({ from: "2026-10-02", to: null })).toBe(true);
  });
});
