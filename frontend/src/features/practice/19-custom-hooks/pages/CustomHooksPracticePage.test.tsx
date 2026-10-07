import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CustomHooksPracticePage } from "./CustomHooksPracticePage";

const renderPage = () => render(<MemoryRouter><CustomHooksPracticePage /></MemoryRouter>);

describe("CustomHooksPracticePage", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("추가한 메모를 저장해 다시 열어도 남는다", () => {
    const { unmount } = renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "제목" }), { target: { value: "커스텀 훅 복습" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    unmount();

    renderPage();
    expect(within(screen.getByRole("list", { name: "읽을거리 목록" })).getByText("커스텀 훅 복습")).toBeInTheDocument();
  });

  it("검색어는 입력이 멈춘 뒤에 적용된다", () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: "검색" }), { target: { value: "sync" } });
    expect(within(screen.getByRole("list", { name: "읽을거리 목록" })).getAllByRole("listitem")).toHaveLength(2);

    act(() => { vi.advanceTimersByTime(300); });
    expect(within(screen.getByRole("list", { name: "읽을거리 목록" })).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(/실제로 거른 검색어: "sync"/)).toBeInTheDocument();
  });
});
