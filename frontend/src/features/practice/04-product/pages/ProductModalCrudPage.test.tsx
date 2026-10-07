import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { installDialogPolyfill } from "@/test/testUtils";
import { ProductModalCrudPage } from "./ProductModalCrudPage";

vi.mock("@/shared/notification/applicationNotification", () => ({
  applicationNotification: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn() },
}));

const renderPage = () => render(<MemoryRouter><ProductModalCrudPage /></MemoryRouter>);

describe("ProductModalCrudPage", () => {
  beforeAll(installDialogPolyfill);

  it("추가 모달에서 검증을 통과한 상품만 목록에 더한다", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "상품 추가 모달" }));
    const dialog = screen.getByRole("dialog", { name: "상품 추가" });

    fireEvent.click(within(dialog).getByRole("button", { name: "상품 추가" }));
    expect(await within(dialog).findByText("상품명을 입력해 주세요.")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("textbox", { name: /^상품명/ }), { target: { value: "무선 마우스" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^카테고리/ }), { target: { value: "주변기기" } });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: /^가격/ }), { target: { value: "39000" } });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: /^재고/ }), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "상품 추가" }));

    expect(await within(screen.getByRole("table")).findByText("무선 마우스")).toBeInTheDocument();
  });

  it("검색어로 목록을 거르고, 삭제 확인을 거쳐야 지운다", () => {
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "상품 검색" }), { target: { value: "키보드" } });
    const table = screen.getByRole("table");
    expect(within(table).getByText("기계식 키보드")).toBeInTheDocument();
    expect(within(table).queryByText("React 입문 교재")).not.toBeInTheDocument();

    fireEvent.click(within(table).getByRole("button", { name: "삭제 모달" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "상품 삭제" })).getByRole("button", { name: "삭제" }));
    expect(within(table).queryByText("기계식 키보드")).not.toBeInTheDocument();
  });
});
