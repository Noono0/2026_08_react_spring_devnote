import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { closestElement, firstItem, installDialogPolyfill } from "@/test/testUtils";
import { CommentPracticePage } from "./CommentPracticePage";

// 알림은 화면에 그리지 않고 어떤 문구로 불렸는지만 확인한다. vi.hoisted: vi.mock보다 먼저 만들어지도록 끌어올린다.
const notificationMock = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), apiError: vi.fn() }));
vi.mock("@/shared/notification/applicationNotification", () => ({ applicationNotification: notificationMock }));

const renderPage = () => render(<MemoryRouter><CommentPracticePage /></MemoryRouter>);
const commentCard = (content: string | RegExp) => closestElement(screen.getByText(content), "article");
const confirmDelete = () => fireEvent.click(within(screen.getByRole("dialog", { name: "댓글 삭제" })).getByRole("button", { name: "삭제" }));

describe("CommentPracticePage", () => {
  beforeAll(installDialogPolyfill);

  it("빈 댓글은 막고, 최상위 댓글에 대댓글을 단다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));
    expect(notificationMock.warning).toHaveBeenCalledWith("댓글 내용을 입력해 주세요.");

    fireEvent.change(screen.getByRole("textbox", { name: "새 댓글" }), { target: { value: "새로 쓴 댓글" } });
    fireEvent.click(screen.getByRole("button", { name: "댓글 등록" }));

    fireEvent.click(within(commentCard("새로 쓴 댓글")).getByRole("button", { name: "답글" }));
    fireEvent.change(screen.getByRole("textbox", { name: "대댓글 내용" }), { target: { value: "새 대댓글" } });
    fireEvent.click(screen.getByRole("button", { name: "대댓글 등록" }));

    // 대댓글 카드에는 답글 버튼이 없다(2단계까지만).
    expect(within(commentCard("새 대댓글")).queryByRole("button", { name: "답글" })).not.toBeInTheDocument();
  });

  it("대댓글이 있는 부모는 자리만 남기고, 자식이 없는 댓글은 완전히 지운다", () => {
    renderPage();
    // 부모 카드 안에 대댓글 카드가 들어 있어 삭제 버튼이 여러 개다. 화면 순서상 첫 번째가 부모 댓글의 버튼이다.
    fireEvent.click(firstItem(within(commentCard("부모 댓글과 자식 댓글 구조를 확인해 보세요.")).getAllByRole("button", { name: "삭제" })));
    confirmDelete();
    expect(screen.getByText("삭제된 댓글입니다.")).toBeInTheDocument();
    expect(screen.getByText("이 댓글은 1번 댓글의 대댓글입니다.")).toBeInTheDocument();

    fireEvent.click(within(commentCard("삭제된 부모 댓글의 자식은 어떻게 보여야 할까요?")).getByRole("button", { name: "삭제" }));
    confirmDelete();
    expect(screen.queryByText("삭제된 부모 댓글의 자식은 어떻게 보여야 할까요?")).not.toBeInTheDocument();
  });
});
