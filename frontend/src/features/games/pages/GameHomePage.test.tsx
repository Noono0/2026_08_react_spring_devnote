import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { gameExerciseList } from "@/features/curriculum/data/gameExercises";
import { GameHomePage } from "@/features/games/pages/GameHomePage";

describe("게임 홈", () => {
  it("온라인 대전·게임 랭킹·타로 카드로 가는 링크를 보여 준다", () => {
    render(<MemoryRouter><GameHomePage /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /온라인 대전/ })).toHaveAttribute("href", "/games/online");
    expect(screen.getByRole("link", { name: /게임 랭킹/ })).toHaveAttribute("href", "/games/rankings");
    expect(screen.getByRole("link", { name: /타로 카드 뽑기/ })).toHaveAttribute("href", "/games/tarot");
    expect(screen.getByRole("heading", { name: "부루마블" }).closest("a")).toHaveAttribute("href", "/games/marble");
    expect(screen.getByRole("heading", { name: "미로게임" }).closest("a")).toHaveAttribute("href", "/games/maze");
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).not.toContain("/games/memory");
    expect(links).not.toContain("/games/tetris");
  });

  it("게임 규칙 직접 만들어 보기는 React 연습의 연습 화면으로 안내한다", () => {
    render(<MemoryRouter><GameHomePage /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "카드 섞기(피셔–예이츠)" })).toHaveAttribute("href", "/react/game-exercises/memory-shuffle");
    gameExerciseList.forEach((exercise) => {
      expect(screen.getByRole("link", { name: exercise.title })).toHaveAttribute("href", `/react/game-exercises/${exercise.exerciseId}`);
    });
  });
});
