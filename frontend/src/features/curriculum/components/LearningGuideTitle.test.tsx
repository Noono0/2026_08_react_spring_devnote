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

  it("연습 단계 제목 옆에 사이트 안 편집기·StackBlitz·Codespaces 중 고를 수 있는 메뉴를 둔다", () => {
    render(<LearningGuideTitle guideId="todo">할 일 로컬 CRUD</LearningGuideTitle>);

    // 메뉴를 펼치는 버튼 이름에 단계 제목을 넣어 어떤 단계의 실습인지 알 수 있다.
    expect(screen.getByText("▶ 직접 해 보기")).toHaveAccessibleName("할 일 인라인 CRUD 직접 해 보기");
    const stackBlitzLink = screen.getByRole("link", { name: /StackBlitz에서 실제 코드 열기/ });
    const codespacesLink = screen.getByRole("link", { name: /Codespaces에서 전체 실행/ });
    expect(stackBlitzLink.getAttribute("href")).toContain("stackblitz.com/github/Noono0/2026_08_react_spring_devnote/tree/main/frontend");
    expect(codespacesLink.getAttribute("href")).toContain("codespaces.new/Noono0/2026_08_react_spring_devnote");
    // 새 탭으로 여는 외부 링크는 원래 페이지를 조작하지 못하게 noopener를 붙인다.
    expect(stackBlitzLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(stackBlitzLink).toHaveAttribute("target", "_blank");
  });

  it("로드맵 안내(0단계)와 학습 단계가 아닌 화면에는 직접 해 보기 메뉴를 만들지 않는다", () => {
    const { unmount } = render(<LearningGuideTitle guideId="roadmap">전체 로드맵</LearningGuideTitle>);
    expect(screen.queryByText("▶ 직접 해 보기")).not.toBeInTheDocument();
    unmount();

    render(<LearningGuideTitle helpTopic="history">나의 업무 History</LearningGuideTitle>);
    expect(screen.queryByText("▶ 직접 해 보기")).not.toBeInTheDocument();
  });
});
