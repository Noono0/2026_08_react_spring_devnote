import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { MarblePage } from "./MarblePage";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it("컴퓨터 수를 반영하고 내 차례에서만 조작하며 새 게임은 이전 컴퓨터 타이머를 정리한다", async () => {
  vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(0);
  const view = render(<MemoryRouter><MarblePage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("컴퓨터 수"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
  expect(screen.getAllByText("현금 150만원")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "주사위 굴리기" }));
  expect(screen.getByRole("button", { name: "주사위 굴리기" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "차례 마치기" }));
  expect(screen.getByRole("status")).toHaveTextContent("컴퓨터 1 차례");
  await act(() => vi.advanceTimersByTime(650));
  fireEvent.click(screen.getByRole("button", { name: "새 게임 시작" }));
  await act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByRole("status")).toHaveTextContent("나 차례");
  expect(screen.getByRole("button", { name: "주사위 굴리기" })).toBeEnabled();
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});
