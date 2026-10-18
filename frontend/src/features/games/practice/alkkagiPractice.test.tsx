import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { countAlive, createPracticeStones, simulateFlick } from "@/features/games/alkkagi/alkkagiPhysics";
import { AlkkagiPractice } from "./AlkkagiPractice";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("알까기 혼자 연습", () => {
  it("흑 알을 골라 튕기면 횟수가 늘고, 궤적 재생이 끝나면 다시 튕길 수 있다", () => {
    vi.useFakeTimers();
    render(<AlkkagiPractice />);
    expect(screen.getByText("남은 흑 4 · 남은 백 6")).toBeInTheDocument();
    const controls = screen.getByRole("group", { name: "연습 튕기기 조작" });
    fireEvent.change(within(controls).getByLabelText("내 알"), { target: { value: "1" } });
    fireEvent.change(within(controls).getByLabelText(/각도/), { target: { value: "90" } });
    fireEvent.change(within(controls).getByLabelText(/힘/), { target: { value: "100" } });
    fireEvent.click(within(controls).getByRole("button", { name: "튕기기" }));

    // 화면은 브라우저 물리 계산(alkkagiPhysics) 결과를 그대로 보여 준다
    const expected = simulateFlick(createPracticeStones(), 1, 90, 100);
    expect(screen.getByText("튕긴 횟수 1")).toBeInTheDocument();
    expect(screen.getByText(`남은 흑 ${countAlive(expected.stones, 0)} · 남은 백 ${countAlive(expected.stones, 1)}`)).toBeInTheDocument();
    expect(screen.getByText("알이 굴러가는 중…")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "연습 튕기기 조작" })).not.toBeInTheDocument(); // 재생 중에는 못 튕긴다

    act(() => {
      vi.advanceTimersByTime(expected.frames.length * 40);
    });
    expect(screen.getByText("튕길 흑 알을 누르세요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "처음부터" }));
    expect(screen.getByText("튕긴 횟수 0")).toBeInTheDocument();
    expect(screen.getByText("남은 흑 4 · 남은 백 6")).toBeInTheDocument();
  });
});
