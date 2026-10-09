import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findLearningGuideById } from "@/features/curriculum/data/learningGuides";
import { useStageSandboxStore } from "@/features/curriculum/state/stageSandboxStore";
import { OnlinePracticeMenu } from "./OnlinePracticeMenu";
import { StageSandboxSection } from "./StageSandboxSection";

// 실제 Sandpack은 외부 번들러(iframe)를 쓰므로 테스트에서는 가짜 패널로 바꾼다.
vi.mock("@/features/curriculum/components/StageSandboxPanel", () => ({
  default: ({ learningGuide }: { learningGuide: { title: string } }) => <p>{learningGuide.title} 편집기 패널</p>,
}));

beforeEach(() => {
  useStageSandboxStore.setState({ expandedGuideId: null });
  // jsdom에는 scrollIntoView가 없어 빈 함수로 채운다.
  Element.prototype.scrollIntoView = vi.fn();
});

const renderTodoStage = (pathname = "/react/todos") => {
  const learningGuide = findLearningGuideById("todo");
  if (!learningGuide) throw new Error("todo 가이드가 없습니다.");
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <OnlinePracticeMenu learningGuide={learningGuide} />
      <StageSandboxSection />
    </MemoryRouter>,
  );
};

describe("연습 화면 아래 직접 해 보기 영역", () => {
  it("처음에는 접혀 있고, 펼칠 때만 편집기를 불러오며 다시 접을 수 있다", async () => {
    renderTodoStage();
    const toggle = screen.getByRole("button", { name: /2단계 직접 해 보기/ });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("할 일 인라인 CRUD 편집기 패널")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("할 일 인라인 CRUD 편집기 패널")).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("할 일 인라인 CRUD 편집기 패널")).not.toBeInTheDocument();
  });

  it("제목 옆 메뉴의 '이 화면 아래에서 바로 편집'을 누르면 아래 영역이 펼쳐진다", async () => {
    renderTodoStage();
    fireEvent.click(screen.getByRole("button", { name: /이 화면 아래에서 바로 편집/ }));

    expect(screen.getByRole("button", { name: /2단계 직접 해 보기/ })).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("할 일 인라인 CRUD 편집기 패널")).toBeInTheDocument();
  });

  it("학습 단계가 아닌 화면에서는 영역을 그리지 않는다", () => {
    render(<MemoryRouter initialEntries={["/react"]}><StageSandboxSection /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /직접 해 보기/ })).not.toBeInTheDocument();
  });
});
