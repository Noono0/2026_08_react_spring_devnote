import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { CalendarHolidayManager } from "./CalendarHolidayManager";
import type { CalendarHoliday } from "./calendarHolidayApi";

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: {} }));
vi.mock("./calendarHolidayApi", async (importOriginal) => ({ ...await importOriginal<typeof import("./calendarHolidayApi")>(), calendarHolidayApi: api }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: { success: vi.fn(), apiError: vi.fn() } }));
vi.mock("@/shared/ui/ConfirmDialog", () => ({
  ConfirmDialog: ({ isOpen, onConfirm, onCancel }: { isOpen: boolean; onConfirm: () => void; onCancel: () => void }) => isOpen
    ? <div role="dialog"><button onClick={onConfirm}>삭제하기</button><button onClick={onCancel}>취소</button></div> : null,
}));
const custom: CalendarHoliday = { holidayId: 4, date: "2026-11-13", name: "회사 휴무", kind: "COMPANY", official: false, versionNumber: 2 };
const renderManager = (holidays: CalendarHoliday[] = []) => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}><CalendarHolidayManager month="2026-11" holidays={holidays} /></QueryClientProvider>);
  fireEvent.click(screen.getByText("휴일 관리"));
  return invalidate;
};
beforeEach(() => {
  vi.clearAllMocks();
  api.create.mockResolvedValue(custom);
  api.update.mockResolvedValue(custom);
  api.delete.mockResolvedValue(undefined);
});

it("이름 누락을 알리고 대체공휴일 추가 후 월별 캐시를 갱신한다", async () => {
  const invalidate = renderManager();
  fireEvent.click(screen.getByRole("button", { name: "휴일 추가" }));
  expect(screen.getByLabelText("휴일 이름 *")).toHaveFocus();
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("휴일 날짜 *"), { target: { value: "2026-11-13" } });
  fireEvent.change(screen.getByLabelText("휴일 이름 *"), { target: { value: "임시 대체휴일" } });
  fireEvent.change(screen.getByLabelText("휴일 종류"), { target: { value: "SUBSTITUTE" } });
  fireEvent.click(screen.getByRole("button", { name: "휴일 추가" }));
  await waitFor(() => expect(api.create).toHaveBeenCalledWith({ date: "2026-11-13", name: "임시 대체휴일", kind: "SUBSTITUTE" }));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["board-lab", "holidays"] }));
});

it("직접 등록한 휴일만 수정하고 현재 버전을 전송한다", async () => {
  renderManager([custom, { holidayId: null, date: "2026-11-01", name: "공식 휴일", kind: "PUBLIC", official: true, versionNumber: null }]);
  expect(screen.queryByRole("button", { name: "공식 휴일 수정" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "회사 휴무 수정" }));
  expect(screen.getByLabelText("휴일 이름 *")).toHaveValue("회사 휴무");
  fireEvent.change(screen.getByLabelText("휴일 이름 *"), { target: { value: "변경한 휴무" } });
  fireEvent.click(screen.getByRole("button", { name: "휴일 수정 저장" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith(4, { date: "2026-11-13", name: "변경한 휴무", kind: "COMPANY", versionNumber: 2 }));
});

it("삭제 확인 취소는 보존하고 확인한 경우에만 버전과 함께 삭제한다", async () => {
  renderManager([custom]);
  fireEvent.click(screen.getByRole("button", { name: "회사 휴무 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "회사 휴무 삭제" }));
  fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith(4, 2));
});
