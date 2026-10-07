import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
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

  it("지금 로드맵에 없는 옛 단계 ID는 진행률에 세지 않는다", () => {
    useLearningProgressStore.setState({ completedStageIds: ["removed-stage", "todo"], completedTaskKeys: [] });
    render(<MemoryRouter><LearningRoadmapPage /></MemoryRouter>);

    expect(screen.getByText(`1 / ${roadmapLearningGuides.length}단계 완료 · 이 브라우저에 저장됩니다.`)).toBeInTheDocument();
  });
});
