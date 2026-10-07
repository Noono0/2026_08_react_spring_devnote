import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PerformancePracticePage } from "./PerformancePracticePage";

const renderPage = () => render(<MemoryRouter><PerformancePracticePage /></MemoryRouter>);

/**
 * 2,000개 줄 전체에서 role로 버튼을 찾으면 매우 느리다(접근성 이름을 줄마다 계산).
 * 그래서 먼저 검색어로 목록을 좁힌 뒤, 목록 안에서만 찾는다.
 */
const narrowListTo = async (keyword: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: "검색" }), { target: { value: keyword } });
  // useDeferredValue가 늦게 따라오므로 "갱신 중"이 끝나 결과 문구가 나올 때까지 기다린다.
  await screen.findByText(/^\d+개 표시/);
  return screen.getByRole("list", { name: "상품 목록" });
};

describe("PerformancePracticePage", () => {
  it("최적화를 켜고 꺼도 즐겨찾기 동작은 같다", async () => {
    renderPage();
    const list = await narrowListTo("키보드 1호");
    fireEvent.click(within(list).getByRole("button", { name: "키보드 1호 즐겨찾기" }));
    expect(within(list).getByRole("button", { name: "키보드 1호 즐겨찾기" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("checkbox", { name: /최적화 켜기/ }));
    fireEvent.click(within(list).getByRole("button", { name: "키보드 1호 즐겨찾기" }));

    expect(within(list).getByRole("button", { name: "키보드 1호 즐겨찾기" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/즐겨찾기 0개/)).toBeInTheDocument();
  });

  it("검색어로 목록을 거르고 Profiler 측정값을 보여 준다", async () => {
    renderPage();
    const list = await narrowListTo("모니터 13");

    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.textContent?.includes("모니터 13"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "측정값 보기" }));
    expect(screen.getByText(/실제 .*ms/)).toBeInTheDocument();
  });
});
