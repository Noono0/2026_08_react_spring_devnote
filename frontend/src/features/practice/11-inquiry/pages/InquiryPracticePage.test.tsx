import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { installDialogPolyfill } from "@/test/testUtils";
import { InquiryPracticePage } from "./InquiryPracticePage";

// 알림은 화면에 그리지 않고 어떤 문구로 불렸는지만 확인한다. vi.hoisted: vi.mock보다 먼저 만들어지도록 끌어올린다.
const notificationMock = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn() }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: notificationMock }));

const renderPage = () => render(<MemoryRouter><InquiryPracticePage /></MemoryRouter>);
const changeRole = (role: "USER" | "MANAGER" | "ADMIN") =>
  fireEvent.change(screen.getByRole("combobox", { name: "현재 역할" }), { target: { value: role } });

describe("InquiryPracticePage", () => {
  beforeAll(installDialogPolyfill);

  it("USER는 문의를 등록하고, 관리자 역할에서는 등록 버튼이 잠긴다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "문의 등록" }));
    const dialog = screen.getByRole("dialog", { name: "새 문의 등록" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "제목" }), { target: { value: "로그인 문의" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "내용" }), { target: { value: "로그인이 안 됩니다." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "문의 등록" }));
    expect(notificationMock.success).toHaveBeenCalledWith("문의를 등록했습니다.");
    expect(screen.getByRole("button", { name: /로그인 문의/ })).toBeInTheDocument();

    changeRole("MANAGER");
    // 관리자 역할에서는 등록 버튼을 잠근다. (등록 함수도 역할을 한 번 더 확인해 막는다)
    expect(screen.getByRole("button", { name: "문의 등록" })).toBeDisabled();
  });

  it("관리자는 문의를 자신에게 배정하고 답변을 저장한다", () => {
    renderPage();
    changeRole("ADMIN");
    fireEvent.click(screen.getByRole("button", { name: /이미지 업로드가 실패합니다/ }));
    fireEvent.click(screen.getByRole("button", { name: "내게 배정" }));
    expect(screen.getByText(/담당자 시스템 관리자/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "관리자 답변" }), { target: { value: "파일 크기를 확인해 주세요." } });
    fireEvent.click(screen.getByRole("button", { name: "답변 저장" }));
    expect(notificationMock.success).toHaveBeenCalledWith("답변을 저장했습니다.");
  });
});
