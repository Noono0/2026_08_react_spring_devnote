import { fireEvent, render, screen } from "@testing-library/react";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = false; },
  });
});

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

  it("업무 History 제목 옆의 ?에서 화면 사용 순서를 연다", () => {
    render(<LearningGuideTitle helpTopic="history">나의 업무 History</LearningGuideTitle>);

    const heading = screen.getByRole("heading", { level: 1, name: "나의 업무 History" });
    const button = screen.getByRole("button", { name: "나의 업무 History 사용 설명 열기" });
    expect(heading.parentElement).toContainElement(button);

    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "나의 업무 History 사용 설명" })).toBeInTheDocument();
    expect(screen.getByText(/태그 버튼을 누르면 같은 태그의 글만/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "나의 업무 History 사용 설명" })).not.toBeInTheDocument();
  });
});
