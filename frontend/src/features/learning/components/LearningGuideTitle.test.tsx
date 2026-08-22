import { render, screen } from "@testing-library/react";
import { LearningGuideTitle } from "@/features/learning/components/LearningGuideTitle";

describe("LearningGuideTitle", () => {
  it("현재 실습의 설명 버튼을 큰 제목 바로 옆에 렌더링한다", () => {
    render(
      <LearningGuideTitle guideId="todo">할 일 로컬 CRUD</LearningGuideTitle>,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "할 일 로컬 CRUD" });
    const guideButton = screen.getByRole("button", { name: "할 일 인라인 CRUD 학습 가이드 열기" });

    expect(heading.parentElement).toHaveClass("page-title-with-guide");
    expect(heading.parentElement).toContainElement(guideButton);
  });

  it("학습 가이드가 없는 일반 화면에는 설명 버튼을 만들지 않는다", () => {
    render(
      <LearningGuideTitle>나의 업무 History</LearningGuideTitle>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "나의 업무 History" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
