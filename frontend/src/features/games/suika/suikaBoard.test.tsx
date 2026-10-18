import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuikaBoard } from "@/features/games/suika/SuikaBoard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("수박게임 판", () => {
  it("←·→로 옮기고 Space로 떨어뜨리면 상자에 과일이 생기고 다음 과일로 바뀐다", () => {
    // 0 → 항상 체리. performance.now를 늘려 떨어뜨리기 대기 시간(0.5초)을 넘긴다
    let now = 10_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const { container } = render(<SuikaBoard random={() => 0} />);
    const board = screen.getByRole("application", { name: /수박게임 상자\. 떨어뜨릴 과일 체리/ });
    fireEvent.keyDown(board, { key: "ArrowLeft", shiftKey: true });
    fireEvent.keyDown(board, { key: " " });
    expect(container.querySelectorAll("circle.suika-fruit")).toHaveLength(1);
    fireEvent.keyDown(board, { key: " " }); // 0.5초 안에 다시 누르면 무시
    expect(container.querySelectorAll("circle.suika-fruit")).toHaveLength(1);
    now += 600;
    fireEvent.keyDown(board, { key: "Enter" });
    expect(container.querySelectorAll("circle.suika-fruit")).toHaveLength(2);
  });

  it("멈춘(disabled) 판에서는 떨어뜨릴 수 없다", () => {
    const { container } = render(<SuikaBoard random={() => 0} disabled />);
    fireEvent.keyDown(screen.getByRole("application"), { key: " " });
    expect(container.querySelectorAll("circle.suika-fruit")).toHaveLength(0);
  });
});
