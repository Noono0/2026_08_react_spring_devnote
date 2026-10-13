import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LearningLevelPage } from "./LearningLevelPage";

const renderLevel = (level: string) => render(
  <MemoryRouter initialEntries={[`/react/level/${level}`]}>
    <Routes>
      <Route path="/react" element={<p>로드맵 화면</p>} />
      <Route path="/react/level/:level" element={<LearningLevelPage />} />
    </Routes>
  </MemoryRouter>,
);

const exerciseSection = () => screen.getByRole("region", { name: "게임 규칙 직접 만들어 보기" });

describe("LearningLevelPage 게임 규칙 직접 만들어 보기", () => {
  it("초급에는 카드 섞기·2048 한 줄 밀기·스도쿠 숫자 놓기 검사가 붙는다", () => {
    renderLevel("basic");
    const section = exerciseSection();
    expect(within(section).getByRole("link", { name: "카드 섞기(피셔–예이츠) 연습 시작" })).toHaveAttribute("href", "/react/game-exercises/memory-shuffle");
    expect(within(section).getByRole("link", { name: "2048 한 줄 밀기 연습 시작" })).toHaveAttribute("href", "/react/game-exercises/2048-slide-row");
    expect(within(section).getByRole("link", { name: "스도쿠 숫자 놓기 검사 연습 시작" })).toHaveAttribute("href", "/react/game-exercises/sudoku-placement");
    expect(within(section).getAllByRole("article")).toHaveLength(3);
  });

  it("중급에는 테트리스 줄 지우기·지뢰 찾기 연쇄 열기가 붙는다", () => {
    renderLevel("intermediate");
    const section = exerciseSection();
    expect(within(section).getByRole("link", { name: "테트리스 줄 지우기 연습 시작" })).toHaveAttribute("href", "/react/game-exercises/tetris-clear-lines");
    expect(within(section).getByRole("link", { name: "지뢰 찾기 빈 칸 연쇄 열기(BFS) 연습 시작" })).toHaveAttribute("href", "/react/game-exercises/minesweeper-reveal-area");
    expect(within(section).getAllByRole("article")).toHaveLength(2);
  });

  it("게임 연습이 없는 난이도에는 묶음을 그리지 않고, 없는 난이도 주소는 로드맵으로 보낸다", () => {
    const { unmount } = renderLevel("deep");
    expect(screen.getByRole("heading", { level: 1, name: /심화 학습 과정/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "게임 규칙 직접 만들어 보기" })).not.toBeInTheDocument();
    unmount();
    renderLevel("banana");
    expect(screen.getByText("로드맵 화면")).toBeInTheDocument();
  });
});
