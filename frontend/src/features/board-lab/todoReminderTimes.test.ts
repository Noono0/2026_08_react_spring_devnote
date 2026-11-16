import { expect, it } from "vitest";
import { parseReminderDrafts, toLocalDateTime } from "./todoReminderTimes";

const now = new Date("2030-01-01T00:00:00Z").getTime();
it("여러 현지 시간을 UTC로 변환하고 입력 순서를 유지한다", () => {
  const values = ["2030-02-01T09:00", "2030-02-03T18:30"];
  expect(parseReminderDrafts(values.map((localTime, index) => ({ id: String(index), localTime })), now)).toEqual(values.map((value) => new Date(value).toISOString()));
});
it("이미 발송된 기존 시간은 초 단위까지 보존한다", () => {
  const originalTime = "2029-01-01T00:00:23Z";
  expect(parseReminderDrafts([{ id: "1", localTime: toLocalDateTime(originalTime), originalTime }], now)).toEqual([originalTime]);
});
it("빈 시간·잘못된 날짜·과거·중복·5년 이후의 새 시간을 거절한다", () => {
  for (const localTime of ["", "invalid", "2030-02-30T09:00", "2029-01-01T09:00", "2040-01-01T09:00"]) {
    expect(() => parseReminderDrafts([{ id: "1", localTime }], now)).toThrow();
  }
  expect(() => parseReminderDrafts([{ id: "1", localTime: "2030-02-01T09:00" }, { id: "2", localTime: "2030-02-01T09:00" }], now)).toThrow("동일한 알림 시간");
});
it("기존 시간을 바꿨으면 새 시간으로 검증하고 UTC로 저장한다", () => {
  expect(parseReminderDrafts([{ id: "1", localTime: "2030-02-01T09:00", originalTime: "2029-01-01T00:00:00Z" }], now)).toEqual([new Date("2030-02-01T09:00").toISOString()]);
});
