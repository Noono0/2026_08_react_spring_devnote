import { buildCronExpression, nextCronRuns, type CronFields } from "@/features/utility/utils/cronUtils";

const fields: CronFields = { second: "0", minute: "*/10", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" };

describe("cronUtils", () => {
  it("Spring과 Linux 필드 수를 구분한다", () => {
    expect(buildCronExpression("SPRING", fields)).toBe("0 */10 * * * *");
    expect(buildCronExpression("LINUX", fields)).toBe("*/10 * * * *");
  });

  it("필드 범위와 잘못된 간격을 거부한다", () => {
    expect(() => buildCronExpression("SPRING", { ...fields, minute: "60" })).toThrow("0~59");
    expect(() => buildCronExpression("LINUX", { ...fields, dayOfMonth: "?" })).toThrow("?를 사용할 수 없습니다");
    expect(() => buildCronExpression("SPRING", { ...fields, minute: "*/0" })).toThrow("간격");
  });

  it("기준 시각 다음의 실행 예정 시간을 계산한다", () => {
    const runs = nextCronRuns("SPRING", fields, new Date("2026-08-14T00:01:30.000Z"), 2);
    expect(runs.map((run) => run.toISOString())).toEqual(["2026-08-14T00:10:00.000Z", "2026-08-14T00:20:00.000Z"]);
  });
});
