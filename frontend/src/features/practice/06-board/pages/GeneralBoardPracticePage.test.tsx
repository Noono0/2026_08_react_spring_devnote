import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { installDialogPolyfill } from "@/test/testUtils";
import { GeneralBoardPracticePage } from "./GeneralBoardPracticePage";

// 알림은 화면에 그리지 않고 어떤 문구로 불렸는지만 확인한다. vi.hoisted: vi.mock보다 먼저 만들어지도록 끌어올린다.
const notificationMock = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn() }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: notificationMock }));

const renderPage = () => render(<MemoryRouter><GeneralBoardPracticePage /></MemoryRouter>);

describe("GeneralBoardPracticePage", () => {
  beforeAll(installDialogPolyfill);

  it("한 페이지에 5개씩 보여 주고 페이지를 넘길 수 있다", () => {
    renderPage();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(6); // 머리글 1 + 글 5
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(within(screen.getByRole("table")).getByText("3번째 React 게시판 연습 글")).toBeInTheDocument();
  });

  it("필수값이 비면 등록하지 않고, 등록한 글은 상세 화면에서 볼 수 있다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "새 글 작성" }));
    fireEvent.click(screen.getByRole("button", { name: "게시글 등록" }));
    expect(notificationMock.warning).toHaveBeenCalledWith("제목, 내용, 작성자를 모두 입력해 주세요.");

    fireEvent.change(screen.getByRole("textbox", { name: "제목" }), { target: { value: "테스트로 쓴 글" } });
    fireEvent.change(screen.getByRole("textbox", { name: "작성자" }), { target: { value: "데브노트" } });
    fireEvent.change(screen.getByRole("textbox", { name: "내용" }), { target: { value: "본문" } });
    fireEvent.click(screen.getByRole("button", { name: "게시글 등록" }));

    fireEvent.click(screen.getByRole("button", { name: "테스트로 쓴 글" }));
    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
    expect(screen.getByText("본문")).toBeInTheDocument();
  });

  it("상세에서 삭제를 확인하면 목록으로 돌아가고 글이 사라진다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "13번째 React 게시판 연습 글" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "게시글 삭제" })).getByRole("button", { name: "삭제" }));

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "13번째 React 게시판 연습 글" })).not.toBeInTheDocument();
  });
});
