import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSeededRandom } from "@/features/games/shared/random";
import { MazePage } from "./MazePage";
import { createMaze, findMazePath } from "./mazeLogic";

beforeEach(() => { localStorage.clear(); vi.spyOn(Math, "random").mockReturnValue(0); vi.useFakeTimers(); vi.setSystemTime(1000); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const start = () => { const view = render(<MemoryRouter><MazePage /></MemoryRouter>); fireEvent.change(screen.getByLabelText("난이도"), { target: { value: "EASY" } }); fireEvent.click(screen.getByRole("button", { name: "미로 시작" })); return view; };
const escape = () => {
  const path = findMazePath(createMaze(11, createSeededRandom(0)));
  const region = screen.getByRole("region", { name: "미로 키보드 조작 영역" });
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]; const next = path[index]; if (!previous || !next) continue;
    fireEvent.keyDown(region, { key: next.row < previous.row ? "ArrowUp" : next.row > previous.row ? "ArrowDown" : next.col < previous.col ? "ArrowLeft" : "ArrowRight" });
  }
};

it("시작 후 키보드 포커스를 주며 벽 방향 이동은 걸음 수에 더하지 않는다", async () => {
  start();
  expect(screen.getByRole("region", { name: "미로 키보드 조작 영역" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "위로 이동" }));
  expect(screen.getByText("0칸")).toBeInTheDocument();
  await act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText("1.0초")).toBeInTheDocument();
});

it("출구 도착 후 시간을 멈추고 개인 기록을 저장하며 새 미로에서 초기화한다", async () => {
  start(); await act(() => vi.advanceTimersByTime(2000)); escape();
  expect(screen.getByRole("heading", { name: "탈출 성공!" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "오른쪽으로 이동" })).toBeDisabled();
  expect(localStorage.getItem("devnote.games.maze.EASY.best-ms")).toBe("2000");
  await act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByText(/2.0초 ·/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "새 미로 시작" }));
  expect(screen.queryByRole("heading", { name: "탈출 성공!" })).not.toBeInTheDocument();
  expect(screen.getByText("0칸")).toBeInTheDocument();
});

it("길 안내를 사용한 판은 기록에서 제외하고 떠날 때 타이머를 정리한다", async () => {
  const view = start(); fireEvent.click(screen.getByRole("button", { name: "길 안내 보기" }));
  expect(screen.getByRole("button", { name: "길 안내 숨기기" })).toHaveAttribute("aria-pressed", "true");
  escape();
  expect(localStorage.getItem("devnote.games.maze.EASY.best-ms")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "새 미로 시작" }));
  view.unmount(); await act(() => vi.runOnlyPendingTimers());
  expect(vi.getTimerCount()).toBe(0);
});

it("화면 이동 버튼에 포커스가 있어도 화살표 키로 계속 이동한다", () => {
  start();
  const path = findMazePath(createMaze(11, createSeededRandom(0)));
  const next = path[1];
  if (!next) throw new Error("이동할 수 있는 길이 없습니다.");
  const button = screen.getByRole("button", { name: "위로 이동" });
  button.focus();
  fireEvent.keyDown(button, { key: next.col > 1 ? "ArrowRight" : "ArrowDown" });
  expect(screen.getByText("1칸")).toBeInTheDocument();
});
