import { describe, expect, it } from "vitest";
import { calculatePollPercentage, createAbsoluteEndsAt, createRelativeEndsAt } from "@/features/utility/utils/pollRules";

describe("pollRules", () => {
  it("복수 선택 막대는 전체 선택 수가 아니라 참여자 수를 기준으로 계산한다", () => {
    expect(calculatePollPercentage(3, 4)).toBe(75);
    expect(calculatePollPercentage(null, 4)).toBe(0);
  });

  it("상대 시간과 잘못된 직접 입력 시간을 구분한다", () => {
    expect(createRelativeEndsAt(10, new Date("2026-08-13T10:00:00.000Z"))).toBe("2026-08-13T10:10:00.000Z");
    expect(createAbsoluteEndsAt("not-a-date")).toBeUndefined();
  });
});
