import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LearningGuideButton } from "@/features/curriculum/components/LearningGuideButton";
import { findLearningGuideById, type LearningGuide } from "@/features/curriculum/data/learningGuides";
import { useLearningProgressStore } from "@/features/curriculum/state/learningProgressStore";
import { closestElement, firstItem, installDialogPolyfill } from "@/test/testUtils";

beforeAll(() => {
  installDialogPolyfill();
});

beforeEach(() => {
  localStorage.clear();
  useLearningProgressStore.setState({ completedStageIds: [], completedTaskKeys: [] });
});

/** 테스트에 쓸 가이드. 없으면 원인을 알려 주며 실패한다. */
const getGuide = (guideId: string): LearningGuide => {
  const learningGuide = findLearningGuideById(guideId);
  if (!learningGuide) throw new Error(`${guideId} 가이드가 없습니다.`);
  return learningGuide;
};

describe("LearningGuideButton 실습 과제·진도", () => {
  it("과제를 체크하면 진도에 저장하고, 힌트는 접힌 채로 보여 준다", () => {
    const todoGuide = getGuide("todo");
    const [firstTask] = todoGuide.practiceTasks;
    if (!firstTask) throw new Error("todo 가이드에 과제가 없습니다.");
    render(<LearningGuideButton learningGuide={todoGuide} />);

    fireEvent.click(screen.getByRole("button", { name: `${todoGuide.title} 학습 가이드 열기` }));
    fireEvent.click(screen.getByRole("tab", { name: "실습 과제" }));

    const taskCheckbox = screen.getByRole("checkbox", { name: firstTask.task });
    fireEvent.click(taskCheckbox);
    expect(taskCheckbox).toBeChecked();
    expect(useLearningProgressStore.getState().completedTaskKeys).toContain(`todo::${firstTask.task}`);

    // 힌트는 <details> 안에 있어 처음에는 접혀 있다.
    const hintDetails = closestElement(firstItem(screen.getAllByText("힌트 보기")), "details");
    expect(hintDetails).not.toHaveAttribute("open");
    expect(within(hintDetails).getByText(firstTask.hint)).toBeInTheDocument();
  });

  it("로드맵 단계에서는 '이 단계 완료' 토글 버튼을 보여 준다", () => {
    const todoGuide = getGuide("todo");
    render(<LearningGuideButton learningGuide={todoGuide} />);
    fireEvent.click(screen.getByRole("button", { name: `${todoGuide.title} 학습 가이드 열기` }));

    const completeButton = screen.getByRole("button", { name: "이 단계 완료로 표시" });
    expect(completeButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(completeButton);

    expect(screen.getByRole("button", { name: "✓ 이 단계 완료함" })).toHaveAttribute("aria-pressed", "true");
    expect(useLearningProgressStore.getState().completedStageIds).toEqual(["todo"]);
  });

  it("0단계 로드맵 안내에는 단계 완료 버튼을 만들지 않는다", () => {
    const roadmapGuide = getGuide("roadmap");
    render(<LearningGuideButton learningGuide={roadmapGuide} />);
    fireEvent.click(screen.getByRole("button", { name: `${roadmapGuide.title} 학습 가이드 열기` }));

    expect(screen.queryByRole("button", { name: "이 단계 완료로 표시" })).not.toBeInTheDocument();
  });
});
