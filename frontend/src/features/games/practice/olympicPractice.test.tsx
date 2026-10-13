import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OlympicPractice } from "./OlympicPractice";

// jsdom에는 Canvas 그리기가 없다. 경기 화면은 그리지 않고(null) 흐름만 확인한다
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("올림픽 혼자 연습", () => {
  it("종목을 고르고 시작하면 첫 종목 경기 화면이 열린다", () => {
    render(<OlympicPractice />);
    fireEvent.click(screen.getByRole("button", { name: "던지기만" }));
    expect(screen.getByRole("checkbox", { name: /창던지기/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /100m 달리기/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "2개 종목 시작" }));
    expect(screen.getByText("1 / 2 종목")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "창던지기 경기 화면" })).toBeInTheDocument();
  });

  it("종목을 모두 빼면 시작할 수 없다", () => {
    render(<OlympicPractice />);
    for (const name of ["100m 달리기", "110m 허들", "멀리뛰기", "창던지기", "해머던지기", "높이뛰기"]) {
      fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(name) }));
    }
    expect(screen.getByRole("button", { name: "0개 종목 시작" })).toBeDisabled();
  });
});
