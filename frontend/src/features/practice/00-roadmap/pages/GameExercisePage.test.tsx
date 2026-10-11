import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useStageSandboxStore } from "@/features/curriculum/state/stageSandboxStore";
import { GameExercisePage } from "./GameExercisePage";

const renderExercise = (exerciseId: string) => render(
  <MemoryRouter initialEntries={[`/react/game-exercises/${exerciseId}`]}>
    <Routes>
      <Route path="/react" element={<p>로드맵 화면</p>} />
      <Route path="/react/game-exercises/:exerciseId" element={<GameExercisePage />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  useStageSandboxStore.setState({ expandedGuideId: null, maximized: false });
});

describe("GameExercisePage", () => {
  it("배우는 개념·실제 코드 위치와 접힌 편집기 상자를 보여 준다", () => {
    renderExercise("tetris-clear-lines");
    expect(screen.getByRole("heading", { level: 1, name: "테트리스 줄 지우기" })).toBeInTheDocument();
    expect(screen.getByText(/2차원 배열 filter/)).toBeInTheDocument();
    expect(screen.getByText("frontend/src/features/games/tetris/tetrisLogic.ts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "중급 학습 과정으로 돌아가기" })).toHaveAttribute("href", "/react/level/intermediate");
    // 편집기는 무거워서 처음에는 접혀 있고, 펼칠 때만 내려받는다
    expect(screen.getByRole("button", { name: /테트리스 줄 지우기 직접 만들어 보기/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("목록에 없는 연습 주소는 로드맵으로 돌려보낸다", () => {
    renderExercise("unknown-game");
    expect(screen.getByText("로드맵 화면")).toBeInTheDocument();
  });
});
