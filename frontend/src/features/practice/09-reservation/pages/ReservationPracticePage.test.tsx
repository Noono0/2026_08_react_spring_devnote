import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { closestElement, installDialogPolyfill } from "@/test/testUtils";
import { ReservationPracticePage } from "./ReservationPracticePage";

// 알림은 화면에 그리지 않고 어떤 문구로 불렸는지만 확인한다. vi.hoisted: vi.mock보다 먼저 만들어지도록 끌어올린다.
const notificationMock = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn() }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: notificationMock }));

const renderPage = () => render(<MemoryRouter><ReservationPracticePage /></MemoryRouter>);

/** 예약 추가 모달을 열고 값을 채운다. 처음 데이터: 회의실 A, 2026-08-07 10:00~11:00 예약이 있다. */
const fillReservation = (values: { resource: string; reserver: string; date: string; start: string; end: string }) => {
  fireEvent.click(screen.getByRole("button", { name: "예약 추가" }));
  const dialog = screen.getByRole("dialog", { name: "예약 추가" });
  fireEvent.change(within(dialog).getByRole("combobox", { name: "예약 자원" }), { target: { value: values.resource } });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "예약자" }), { target: { value: values.reserver } });
  fireEvent.change(within(dialog).getByLabelText("예약 날짜"), { target: { value: values.date } });
  fireEvent.change(within(dialog).getByLabelText("시작 시간"), { target: { value: values.start } });
  fireEvent.change(within(dialog).getByLabelText("종료 시간"), { target: { value: values.end } });
  fireEvent.click(within(dialog).getByRole("button", { name: "예약 등록" }));
};

describe("ReservationPracticePage", () => {
  beforeAll(installDialogPolyfill);

  it("종료 시간이 시작보다 빠르면 저장하지 않는다", () => {
    renderPage();
    fillReservation({ resource: "회의실 B", reserver: "데브노트", date: "2026-08-09", start: "15:00", end: "14:00" });
    expect(notificationMock.warning).toHaveBeenCalledWith("종료 시간은 시작 시간보다 늦어야 합니다.");
  });

  it("같은 자원·같은 시간대가 겹치면 409처럼 막는다", () => {
    renderPage();
    fillReservation({ resource: "회의실 A", reserver: "데브노트", date: "2026-08-07", start: "10:30", end: "11:30" });
    expect(notificationMock.error).toHaveBeenCalledWith("예약 시간이 중복됩니다.", expect.any(String));
  });

  it("겹치지 않는 예약은 등록되고, 확인을 거쳐 취소할 수 있다", () => {
    renderPage();
    fillReservation({ resource: "회의실 A", reserver: "데브노트", date: "2026-08-07", start: "11:00", end: "12:00" });
    expect(notificationMock.success).toHaveBeenCalledWith("예약을 등록했습니다.");
    const reservationRow = closestElement(screen.getByText("데브노트"), "tr, li, article");
    fireEvent.click(within(reservationRow).getByRole("button", { name: "예약 취소" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "예약 취소" })).getByRole("button", { name: "예약 취소" }));
    expect(notificationMock.success).toHaveBeenCalledWith("예약을 취소했습니다.");
  });
});
