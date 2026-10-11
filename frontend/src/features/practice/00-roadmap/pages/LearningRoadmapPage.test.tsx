import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { gameExerciseList } from "@/features/curriculum/data/gameExercises";
import { roadmapLearningGuides } from "@/features/curriculum/data/learningGuides";
import { useLearningProgressStore } from "@/features/curriculum/state/learningProgressStore";
import { LearningRoadmapPage } from "./LearningRoadmapPage";

beforeEach(() => {
  localStorage.clear();
  useLearningProgressStore.setState({ completedStageIds: [], completedTaskKeys: [] });
});

describe("LearningRoadmapPage 학습 진도", () => {
  it("카드의 완료 표시를 누르면 진행률이 올라가고 다시 누르면 내려간다", () => {
    render(<MemoryRouter><LearningRoadmapPage /></MemoryRouter>);
    const totalStageCount = roadmapLearningGuides.length;

    expect(screen.getByText(`0 / ${totalStageCount}단계 완료 · 이 브라우저에 저장됩니다.`)).toBeInTheDocument();
    const todoButton = screen.getByRole("button", { name: "2단계 할 일 인라인 CRUD 완료 표시" });
    fireEvent.click(todoButton);

    expect(todoButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`1 / ${totalStageCount}단계 완료 · 이 브라우저에 저장됩니다.`)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "완료한 학습 단계 비율" })).toHaveAttribute("value", "1");

    fireEvent.click(todoButton);
    expect(screen.getByText(`0 / ${totalStageCount}단계 완료 · 이 브라우저에 저장됩니다.`)).toBeInTheDocument();
  });

  it("단계 아래에 게임 규칙 연습을 난이도 표시와 함께 모두 보여 주고, 진도 단계 수에는 넣지 않는다", () => {
    render(<MemoryRouter><LearningRoadmapPage /></MemoryRouter>);
    const exercises = screen.getByRole("region", { name: "게임 규칙 직접 만들어 보기" });
    expect(within(exercises).getAllByRole("article")).toHaveLength(gameExerciseList.length);
    expect(within(exercises).getByRole("link", { name: "스도쿠 숫자 놓기 검사 연습 시작" })).toHaveAttribute("href", "/react/game-exercises/sudoku-placement");
    expect(within(exercises).getAllByText("중급")).toHaveLength(2);
    expect(screen.getByText(`0 / ${roadmapLearningGuides.length}단계 완료 · 이 브라우저에 저장됩니다.`)).toBeInTheDocument();
  });

  it("지금 로드맵에 없는 옛 단계 ID는 진행률에 세지 않는다", () => {
    useLearningProgressStore.setState({ completedStageIds: ["removed-stage", "todo"], completedTaskKeys: [] });
    render(<MemoryRouter><LearningRoadmapPage /></MemoryRouter>);

    expect(screen.getByText(`1 / ${roadmapLearningGuides.length}단계 완료 · 이 브라우저에 저장됩니다.`)).toBeInTheDocument();
  });
});
