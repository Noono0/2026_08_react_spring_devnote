import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { closestElement, installDialogPolyfill } from "@/test/testUtils";
import { GalleryPracticePage } from "./GalleryPracticePage";

// 알림은 화면에 그리지 않고 어떤 문구로 불렸는지만 확인한다. vi.hoisted: vi.mock보다 먼저 만들어지도록 끌어올린다.
const notificationMock = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn() }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: notificationMock }));

const renderPage = () => render(<MemoryRouter><GalleryPracticePage /></MemoryRouter>);

describe("GalleryPracticePage", () => {
  beforeAll(installDialogPolyfill);

  it("이미지가 아닌 파일과 이미지 없는 등록을 막는다", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("이미지 파일"), { target: { files: [new File(["memo"], "memo.txt", { type: "text/plain" })] } });
    expect(notificationMock.warning).toHaveBeenCalledWith("이미지 파일만 선택할 수 있습니다.");

    fireEvent.change(screen.getByRole("textbox", { name: "제목" }), { target: { value: "제목만 있음" } });
    fireEvent.click(screen.getByRole("button", { name: "이미지 등록" }));
    expect(notificationMock.warning).toHaveBeenCalledWith("제목과 이미지를 선택해 주세요.");
  });

  it("같은 데이터를 카드와 표로 바꿔 보여 주고, 확인 후 삭제한다", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "React 카드 레이아웃 미리보기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "표" }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("Docker 실행 환경")).toBeInTheDocument();

    fireEvent.click(within(closestElement(within(table).getByText("Docker 실행 환경"), "tr")).getByRole("button", { name: "삭제" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "이미지 게시글 삭제" })).getByRole("button", { name: "삭제" }));
    expect(within(screen.getByRole("table")).queryByText("Docker 실행 환경")).not.toBeInTheDocument();
  });

  it("미리보기 버튼으로 큰 이미지를 연다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Spring API 흐름 미리보기" }));
    expect(within(screen.getByRole("dialog", { name: "Spring API 흐름" })).getByRole("img", { name: "Spring API 흐름" })).toBeInTheDocument();
  });
});
