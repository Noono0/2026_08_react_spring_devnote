import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { firstItem } from "@/test/testUtils";
import { TodoPracticePage } from "./TodoPracticePage";

// 알림은 화면에 그리지 않고 어떤 문구로 불렸는지만 확인한다. vi.hoisted: vi.mock보다 먼저 만들어지도록 끌어올린다.
const notificationMock = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn() }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: notificationMock }));

const renderPage = () => render(<MemoryRouter><TodoPracticePage /></MemoryRouter>);

describe("TodoPracticePage", () => {
  it("빈 할 일은 추가하지 않고, Enter로 추가할 수 있다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(notificationMock.warning).toHaveBeenCalledWith("할 일을 입력해 주세요.");

    const input = screen.getByRole("textbox", { name: "새 할 일" });
    fireEvent.change(input, { target: { value: "테스트 작성하기" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("테스트 작성하기")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("완료 상태를 바꾸면 필터 결과도 바뀐다", () => {
    renderPage();
    // 처음 데이터: "컴포넌트 역할 확인하기"만 완료 상태다. 두 항목의 완료 상태를 서로 바꾼다.
    fireEvent.click(screen.getByRole("checkbox", { name: "배열 불변성 연습하기 완료 여부" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "컴포넌트 역할 확인하기 완료 여부" }));
    fireEvent.click(screen.getByRole("button", { name: "완료" }));

    expect(screen.getByText("배열 불변성 연습하기")).toBeInTheDocument();
    expect(screen.queryByText("컴포넌트 역할 확인하기")).not.toBeInTheDocument();
  });

  it("인라인으로 수정하고 삭제할 수 있다", () => {
    renderPage();
    fireEvent.click(firstItem(screen.getAllByRole("button", { name: "수정" })));
    fireEvent.change(screen.getByRole("textbox", { name: "컴포넌트 역할 확인하기 수정 입력" }), { target: { value: "컴포넌트 나누기" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByText("컴포넌트 나누기")).toBeInTheDocument();

    fireEvent.click(firstItem(screen.getAllByRole("button", { name: "삭제" })));
    expect(screen.queryByText("컴포넌트 나누기")).not.toBeInTheDocument();
  });
});
