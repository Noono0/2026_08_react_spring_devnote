import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPLE_TIME_LIMIT_SECONDS } from "@/features/games/apple/appleLogic";
import { ApplePractice } from "./ApplePractice";

vi.mock("@/features/auth/hooks/useAuthSession", () => ({
  useAuthSessionQuery: () => ({ isPending: false, data: { authenticated: false } }),
}));
// 랭킹 API는 서버 주소(환경변수)가 필요하므로 가짜로 바꾼다(waitingPractice.test.tsx와 같은 방법)
vi.mock("@/features/games/ranking/rankingApi", () => ({ recordSoloGame: vi.fn() }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const renderPractice = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter><ApplePractice nickname="철수" /></MemoryRouter>
  </QueryClientProvider>,
);

/** 키보드처럼(클릭 detail 0) 칸을 누른다 */
const pressCell = (row: number, col: number) =>
  fireEvent.click(screen.getByRole("gridcell", { name: new RegExp(`^${row}줄 ${col}칸 `) }));

describe("사과게임 혼자 연습", () => {
  it("시작하면 판이 나오고, 두 칸으로 합 10을 만들면 사과가 사라지며 점수가 오른다", () => {
    vi.useFakeTimers();
    // Math.random 0.5 → 모든 사과가 5. 5 + 5 = 10
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    renderPractice();
    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    expect(screen.getByRole("grid", { name: "사과 판" })).toBeInTheDocument();

    pressCell(1, 1);
    expect(screen.getByRole("gridcell", { name: /^1줄 1칸 사과 5 \(시작 칸\)/ })).toBeInTheDocument();
    pressCell(1, 2);
    expect(screen.getByText(/점수/).querySelector("strong")).toHaveTextContent("2");
    expect(screen.getByRole("gridcell", { name: "1줄 1칸 빈칸" })).toBeInTheDocument();

    // 5 하나만 고르면(합 5) 아무 일도 없다
    pressCell(2, 1);
    pressCell(2, 1);
    pressCell(3, 1);
    pressCell(3, 3); // 5 + 5 + 5 = 15 → 그대로
    expect(screen.getByText(/점수/).querySelector("strong")).toHaveTextContent("2");

    act(() => {
      vi.advanceTimersByTime(APPLE_TIME_LIMIT_SECONDS * 1000 + 500);
    });
    expect(screen.getByText("끝! 사과 2개를 없앴어요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 하기" })).toBeInTheDocument();
    expect(screen.getByText("최고 2")).toBeInTheDocument();
  });
});
