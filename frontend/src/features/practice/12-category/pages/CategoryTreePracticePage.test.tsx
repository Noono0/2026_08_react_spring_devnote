import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { installDialogPolyfill } from "@/test/testUtils";
import { CategoryTreePracticePage } from "./CategoryTreePracticePage";

// 알림은 화면에 그리지 않고 어떤 문구로 불렸는지만 확인한다. vi.hoisted: vi.mock보다 먼저 만들어지도록 끌어올린다.
const notificationMock = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn() }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: notificationMock }));

const renderPage = () => render(<MemoryRouter><CategoryTreePracticePage /></MemoryRouter>);
const confirmDelete = () => fireEvent.click(within(screen.getByRole("dialog", { name: "카테고리 삭제" })).getByRole("button", { name: "삭제" }));

describe("CategoryTreePracticePage", () => {
  beforeAll(installDialogPolyfill);

  it("하위 카테고리를 추가하고, 접으면 자식이 숨는다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "React 하위 추가" }));
    const dialog = screen.getByRole("dialog", { name: "하위 카테고리 추가" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "카테고리 이름" }), { target: { value: "Hooks" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "추가" }));
    expect(screen.getByText("Hooks")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "프론트엔드 하위 카테고리 접기" }));
    expect(screen.queryByText("React")).not.toBeInTheDocument();
    expect(screen.queryByText("Hooks")).not.toBeInTheDocument();
  });

  it("하위 항목이 있으면 삭제를 거부하고, 없으면 지운다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "백엔드 삭제" }));
    confirmDelete();
    expect(notificationMock.error).toHaveBeenCalledWith("하위 카테고리가 있어 삭제할 수 없습니다.", expect.any(String));
    expect(screen.getByText("백엔드")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "MyBatis 삭제" }));
    confirmDelete();
    expect(screen.queryByText("MyBatis")).not.toBeInTheDocument();
  });

  it("이름을 수정하고 형제 사이에서 순서를 바꾼다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "TypeScript 위로" }));
    const names = screen.getAllByText(/^(React|TypeScript)$/).map((element) => element.textContent);
    expect(names).toEqual(["TypeScript", "React"]);

    fireEvent.click(screen.getByRole("button", { name: "React 이름 수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "React 새 이름" }), { target: { value: "React 19" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByText("React 19")).toBeInTheDocument();
  });
});
