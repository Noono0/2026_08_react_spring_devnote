import { z } from "zod";
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import { isCalendarDate } from "./calendarDates";

export const holidayKinds = ["PUBLIC", "SUBSTITUTE", "TEMPORARY", "COMPANY"] as const;
export type HolidayKind = typeof holidayKinds[number];
export const holidayKindLabels: Record<HolidayKind, string> = {
  PUBLIC: "공휴일", SUBSTITUTE: "대체공휴일", TEMPORARY: "임시공휴일", COMPANY: "회사 휴무일",
};
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const date = z.string().refine(isCalendarDate);
const dayFields = { date, name: z.string().min(1).max(80), kind: z.enum(holidayKinds) };
const holidaySchema = z.discriminatedUnion("official", [
  z.object({ ...dayFields, official: z.literal(true), holidayId: z.null(), versionNumber: z.null() }),
  z.object({ ...dayFields, official: z.literal(false), holidayId: id, versionNumber: id }),
]);
const holidayMonthSchema = z.object({
  content: z.array(holidaySchema), officialDataAvailable: z.boolean(), supportedYears: z.array(z.number().int().min(1900).max(2100)),
  sourceUrls: z.array(z.string().url().startsWith("https://")), verifiedAt: date.nullable(),
  source: z.enum(["API", "CACHE", "SNAPSHOT", "UNAVAILABLE"]).default("SNAPSHOT"), warning: z.string().max(300).default(""),
});
export type CalendarHoliday = z.infer<typeof holidaySchema>;
export type CustomHoliday = Extract<CalendarHoliday, { official: false }>;
export type HolidayMonth = z.infer<typeof holidayMonthSchema>;
export interface HolidayInput { date: string; name: string; kind: HolidayKind; versionNumber?: number }
const base = "/calendar/holidays";

export const calendarHolidayApi = {
  async month(month: string, signal?: AbortSignal): Promise<HolidayMonth> {
    const response = await selectedHttpClient.get<ApiResponse<unknown>>(base, { queryParameters: { month }, abortSignal: signal });
    return holidayMonthSchema.parse(response.data);
  },
  async create(input: HolidayInput): Promise<CalendarHoliday> {
    const response = await selectedHttpClient.post<HolidayInput, ApiResponse<unknown>>(base, input);
    return holidaySchema.parse(response.data);
  },
  async update(holidayId: number, input: HolidayInput): Promise<CalendarHoliday> {
    const response = await selectedHttpClient.put<HolidayInput, ApiResponse<unknown>>(`${base}/${holidayId}`, input);
    return holidaySchema.parse(response.data);
  },
  async delete(holidayId: number, versionNumber: number): Promise<void> {
    await selectedHttpClient.delete<void>(`${base}/${holidayId}`, { queryParameters: { versionNumber } });
  },
};
