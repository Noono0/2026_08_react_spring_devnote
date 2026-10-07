import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { closestElement, installDialogPolyfill } from "@/test/testUtils";
import { AdminUserPracticePage } from "./AdminUserPracticePage";

// 알림은 화면에 그리지 않고 어떤 문구로 불렸는지만 확인한다. vi.hoisted: vi.mock보다 먼저 만들어지도록 끌어올린다.
const notificationMock = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn() }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: notificationMock }));

const renderPage = () => render(<MemoryRouter><AdminUserPracticePage /></MemoryRouter>);
const userRow = (userName: string) => closestElement(within(screen.getByRole("table")).getByText(userName), "tr");

describe("AdminUserPracticePage", () => {
  beforeAll(installDialogPolyfill);

  it("선택 없이 일괄 변경하면 안내하고, 선택한 사용자만 역할을 바꾼다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "선택 역할 변경" }));
    expect(notificationMock.warning).toHaveBeenCalledWith("역할을 변경할 사용자를 선택해 주세요.");

    fireEvent.click(screen.getByRole("checkbox", { name: "김리액트 선택" }));
    fireEvent.change(screen.getByRole("combobox", { name: "일괄 역할" }), { target: { value: "MANAGER" } });
    fireEvent.click(screen.getByRole("button", { name: "선택 역할 변경" }));

    expect(notificationMock.success).toHaveBeenCalledWith("1명의 역할을 변경했습니다.");
    expect(within(userRow("김리액트")).getByText("관리자")).toBeInTheDocument();
    // 작업이 끝나면 선택을 비운다(같은 사용자를 실수로 두 번 바꾸지 않도록).
    expect(screen.getByRole("checkbox", { name: "김리액트 선택" })).not.toBeChecked();
  });

  it("Soft Delete한 사용자는 삭제 목록으로 옮겨지고 복구할 수 있다", () => {
    renderPage();
    fireEvent.click(within(userRow("박스프링")).getByRole("button", { name: "Soft Delete" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "사용자 Soft Delete" })).getByRole("button", { name: "삭제 상태로 변경" }));
    expect(within(screen.getByRole("table")).queryByText("박스프링")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "삭제 사용자 보기" }));
    fireEvent.click(within(userRow("박스프링")).getByRole("button", { name: "복구" }));
    expect(notificationMock.success).toHaveBeenCalledWith("사용자를 복구했습니다.");
  });
});
