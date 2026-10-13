/**
 * React 연습의 "게임 규칙 직접 만들어 보기" 예제 검사
 *
 * 예제는 Sandpack react-ts 템플릿에 /App.tsx로 들어간다 → App을 기본으로 내보내야 하고,
 * 이 프로젝트 내부 코드(@/…)나 설치하지 않은 패키지는 불러올 수 없다(편집기에는 react·react-dom만 설치).
 * 예제는 진짜 컴포넌트라 테스트에서 그려 볼 수 있다. 처음 코드에는 채점표에 ❌가 남아 있어야 학습자가 완성할 거리가 있다.
 */
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import { gameExerciseList } from "@/features/curriculum/data/gameExercises";
import { learningLevelRoutes } from "@/features/curriculum/data/learningGuides";
import Game2048SlideRow from "./examples/game-2048-slide-row";
import GameMemoryShuffle from "./examples/game-memory-shuffle";
import GameMinesweeperRevealArea from "./examples/game-minesweeper-reveal-area";
import GameSudokuPlacement from "./examples/game-sudoku-placement";
import GameTetrisClearLines from "./examples/game-tetris-clear-lines";
import { stageSandboxSources } from "./stageSandboxes";

const exampleApps: Record<string, ComponentType> = {
  "memory-shuffle": GameMemoryShuffle,
  "2048-slide-row": Game2048SlideRow,
  "sudoku-placement": GameSudokuPlacement,
  "tetris-clear-lines": GameTetrisClearLines,
  "minesweeper-reveal-area": GameMinesweeperRevealArea,
};

describe("게임 규칙 직접 만들어 보기 예제", () => {
  it("연습마다 이름이 겹치지 않고, 난이도 목록 주소가 있는 난이도에 놓인다", () => {
    const ids = gameExerciseList.map((exercise) => exercise.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(exampleApps).sort()).toEqual([...ids].sort());
    gameExerciseList.forEach((exercise) => {
      expect(learningLevelRoutes[exercise.level], exercise.exerciseId).toMatch(/^\/react\/level\//);
      expect(exercise.learningPoints.length, exercise.exerciseId).toBeGreaterThan(0);
    });
  });

  it.each(gameExerciseList)("$exerciseId: 편집기 예제가 등록되어 있고 App 기본 내보내기·해 볼 것·TODO·채점표가 있다", ({ exerciseId }) => {
    const source = stageSandboxSources[exerciseId] ?? "";
    expect(source).toContain("export default function App");
    expect(source).toContain("해 볼 것");
    expect(source).toContain("TODO: 여기를 완성하세요");
    expect(source).toContain("function runChecks");
  });

  it.each(gameExerciseList)("$exerciseId: react 말고 다른 패키지나 프로젝트 내부 코드를 불러오지 않는다", ({ exerciseId }) => {
    const source = stageSandboxSources[exerciseId] ?? "";
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(imports).toEqual(["react"]);
  });

  it.each(gameExerciseList)("$exerciseId: 처음 코드를 그리면 채점표에 아직 ❌가 있다", ({ exerciseId }) => {
    const App = exampleApps[exerciseId];
    if (!App) throw new Error(`${exerciseId} 예제 컴포넌트가 없습니다.`);
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: /채점표/ })).toBeInTheDocument();
    const results = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(results.some((text) => text.startsWith("❌"))).toBe(true);
  });
});
