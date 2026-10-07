import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RefsFocusPracticePage } from "./RefsFocusPracticePage";

const renderPage = () => render(<MemoryRouter><RefsFocusPracticePage /></MemoryRouter>);
// requestAnimationFrame으로 미룬 포커스 이동을 실행한다.
const flushAnimationFrame = () => act(() => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));

describe("RefsFocusPracticePage", () => {
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    // jsdom에는 scrollIntoView가 없어 테스트에서만 빈 함수로 채운다.
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  it("빈 제목이면 오류를 입력칸에 연결하고 그 칸으로 포커스를 옮긴다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    const input = screen.getByRole("textbox", { name: /안건 제목/ });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("안건 제목을 입력해 주세요.");
  });

  it("추가한 뒤에는 입력칸에 포커스를 두고 새 항목으로 스크롤한다", () => {
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: /안건 제목/ }), { target: { value: "회고" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("회고")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /안건 제목/ })).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("항목을 지우면 남은 항목으로, 모두 지우면 입력칸으로 포커스가 간다", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "지난 회의 결정 사항 확인 삭제" }));
    await flushAnimationFrame();
    expect(screen.getByRole("button", { name: "배포 일정 정하기 삭제" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "배포 일정 정하기 삭제" }));
    await flushAnimationFrame();
    expect(screen.getByRole("textbox", { name: /안건 제목/ })).toHaveFocus();
  });
});
