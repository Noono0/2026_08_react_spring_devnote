import { beforeEach, expect, it, vi } from "vitest";
import { calendarHolidayApi } from "./calendarHolidayApi";

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: client }));
const holiday = { holidayId: 1, date: "2026-11-13", name: "회사 휴무", kind: "COMPANY", official: false, versionNumber: 1 };
beforeEach(() => vi.clearAllMocks());

it("월별 휴일을 검증하고 등록·수정·삭제에 버전을 전달한다", async () => {
  client.get.mockResolvedValue({ data: { content: [holiday], officialDataAvailable: true,
    supportedYears: [2026, 2027], sourceUrls: ["https://astro.kasi.re.kr/"], verifiedAt: "2026-11-13" } });
  expect((await calendarHolidayApi.month("2026-11")).content).toEqual([holiday]);
  expect(client.get).toHaveBeenCalledWith("/calendar/holidays", expect.objectContaining({ queryParameters: { month: "2026-11" } }));
  const input = { date: holiday.date, name: holiday.name, kind: "COMPANY" } as const;
  client.post.mockResolvedValue({ data: holiday });
  client.put.mockResolvedValue({ data: { ...holiday, versionNumber: 2 } });
  await calendarHolidayApi.create(input);
  await calendarHolidayApi.update(1, { ...input, versionNumber: 1 });
  await calendarHolidayApi.delete(1, 2);
  expect(client.post).toHaveBeenCalledWith("/calendar/holidays", input);
  expect(client.put).toHaveBeenCalledWith("/calendar/holidays/1", { ...input, versionNumber: 1 });
  expect(client.delete).toHaveBeenCalledWith("/calendar/holidays/1", { queryParameters: { versionNumber: 2 } });
});

it("잘못된 날짜와 직접 등록 휴일의 누락된 식별자를 거부한다", async () => {
  client.post.mockResolvedValue({ data: { ...holiday, date: "2026-02-30" } });
  await expect(calendarHolidayApi.create({ date: "2026-02-30", name: "잘못된 휴일", kind: "TEMPORARY" })).rejects.toThrow();
  client.post.mockResolvedValue({ data: { ...holiday, holidayId: null } });
  await expect(calendarHolidayApi.create({ date: holiday.date, name: holiday.name, kind: "COMPANY" })).rejects.toThrow();
});

it("공휴일 자료 출처와 갱신 실패 안내를 검증한다", async () => {
  const data = { content: [], officialDataAvailable: true, supportedYears: [2028], sourceUrls: ["https://www.data.go.kr/data/15012690/openapi.do"],
    verifiedAt: "2026-11-13", source: "CACHE", warning: "마지막으로 확인한 자료를 표시합니다." };
  client.get.mockResolvedValue({ data });
  expect(await calendarHolidayApi.month("2028-11")).toMatchObject({ source: "CACHE", warning: data.warning });
  client.get.mockResolvedValue({ data: { ...data, source: "UNKNOWN" } });
  await expect(calendarHolidayApi.month("2028-11")).rejects.toThrow();
});
