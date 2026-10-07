import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { addGuestbookMessage, type GuestbookMessage } from "@/features/practice/18-react19-actions/api/localGuestbookApi";
import { ReactActionsGuestbookPage } from "./ReactActionsGuestbookPage";

vi.mock("@/features/practice/18-react19-actions/api/localGuestbookApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/practice/18-react19-actions/api/localGuestbookApi")>()),
  addGuestbookMessage: vi.fn(),
}));
const mockedAddGuestbookMessage = vi.mocked(addGuestbookMessage);

const renderPage = () => render(<MemoryRouter><ReactActionsGuestbookPage /></MemoryRouter>);
const submit = (authorName: string, content: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: authorName } });
  fireEvent.change(screen.getByRole("textbox", { name: "내용" }), { target: { value: content } });
  fireEvent.click(screen.getByRole("button", { name: "방명록 등록" }));
};

describe("ReactActionsGuestbookPage", () => {
  beforeEach(() => {
    mockedAddGuestbookMessage.mockReset();
  });

  it("응답 전에는 저장 중인 글을 먼저 보여 주고 응답 후 진짜 글로 바꾼다", async () => {
    let resolveSave: (message: GuestbookMessage) => void = () => undefined;
    mockedAddGuestbookMessage.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    renderPage();

    submit("이타입", "안녕하세요");

    const list = screen.getByRole("list", { name: "방명록 목록" });
    expect(await within(list).findByText(/저장 중/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "등록 중..." })).toBeDisabled();

    resolveSave({ messageId: 10, authorName: "이타입", content: "안녕하세요", createdAt: "2026-10-04T00:00:00.000Z" });

    expect(await screen.findByRole("status")).toHaveTextContent("방명록을 등록했습니다.");
    expect(within(list).queryByText(/저장 중/)).not.toBeInTheDocument();
    expect(within(list).getByText("안녕하세요")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "방명록 (3)" })).toBeInTheDocument();
  });

  it("저장에 실패하면 임시 글이 사라지고 입력한 내용을 유지한다", async () => {
    mockedAddGuestbookMessage.mockRejectedValue(new Error("연습용 실패"));
    renderPage();

    submit("이타입", "error 테스트");

    expect(await screen.findByRole("alert")).toHaveTextContent("연습용 실패");
    expect(within(screen.getByRole("list", { name: "방명록 목록" })).queryByText(/저장 중/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "내용" })).toHaveValue("error 테스트");
    expect(screen.getByRole("heading", { name: "방명록 (2)" })).toBeInTheDocument();
  });

  it("빈 값은 서버에 보내지 않고 바로 안내한다", async () => {
    renderPage();
    submit("", "");

    expect(await screen.findByRole("alert")).toHaveTextContent("이름과 내용을 모두 입력해 주세요.");
    expect(mockedAddGuestbookMessage).not.toHaveBeenCalled();
  });
});
