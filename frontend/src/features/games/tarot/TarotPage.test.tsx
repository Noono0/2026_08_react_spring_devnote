import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TarotPage } from "@/features/games/tarot/TarotPage";

afterEach(() => vi.restoreAllMocks());

describe("타로 카드 화면", () => {
  it("한 장을 뽑고 펼쳐야 카드 의미와 종합 문장이 보인다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    render(<MemoryRouter><TarotPage /></MemoryRouter>);

    expect(screen.getByText("카드를 섞고 뽑으면 이곳에 뒷면이 놓입니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "카드 섞고 뽑기" }));
    expect(screen.getByRole("button", { name: "오늘의 카드 카드 펼치기" })).toBeInTheDocument();
    expect(screen.queryByText("이번 카드의 이야기")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "오늘의 카드 카드 펼치기" }));
    expect(screen.getByText("이번 카드의 이야기")).toBeInTheDocument();
    expect(screen.getByText(/오늘 살펴볼 주제는/)).toBeInTheDocument();
  });

  it("세 장은 과거·현재·앞으로로 펼치며 모드를 바꾸면 이전 결과가 지워진다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    render(<MemoryRouter><TarotPage /></MemoryRouter>);

    fireEvent.click(screen.getByLabelText("세 장 · 과거 / 현재 / 앞으로"));
    fireEvent.click(screen.getByRole("button", { name: "카드 섞고 뽑기" }));
    expect(screen.getByRole("button", { name: "과거 카드 펼치기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "현재 카드 펼치기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "앞으로 카드 펼치기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "과거 카드 펼치기" }));
    fireEvent.click(screen.getByRole("button", { name: "현재 카드 펼치기" }));
    fireEvent.click(screen.getByRole("button", { name: "앞으로 카드 펼치기" }));
    expect(screen.getByText(/과거의 핵심은/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("한 장 · 오늘의 주제"));
    expect(screen.queryByText("이번 카드의 이야기")).not.toBeInTheDocument();
    expect(screen.getByText("카드를 섞고 뽑으면 이곳에 뒷면이 놓입니다.")).toBeInTheDocument();
  });
});
