import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { findLearningGuideById } from "@/features/curriculum/data/learningGuides";
import { OnlinePracticeMenu } from "./OnlinePracticeMenu";

// 실제 Sandpack은 외부 번들러(iframe)를 쓰므로 테스트에서는 가짜 대화상자로 바꾼다.
vi.mock("@/features/curriculum/components/StageSandboxDialog", () => ({
  default: ({ learningGuide, onRequestClose }: { learningGuide: { title: string }; onRequestClose: () => void }) => (
    <div role="dialog" aria-label="편집기">
      {learningGuide.title} 편집기
      <button type="button" onClick={onRequestClose}>닫기</button>
    </div>
  ),
}));

describe("OnlinePracticeMenu", () => {
  it("'이 화면에서 바로 편집'을 누르면 그때 편집기를 불러와 열고, 닫으면 사라진다", async () => {
    const learningGuide = findLearningGuideById("todo");
    if (!learningGuide) throw new Error("todo 가이드가 없습니다.");
    render(<OnlinePracticeMenu learningGuide={learningGuide} />);

    // 누르기 전에는 편집기를 불러오지 않는다(지연 로딩).
    expect(screen.queryByRole("dialog", { name: "편집기" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /이 화면에서 바로 편집/ }));

    expect(await screen.findByRole("dialog", { name: "편집기" })).toHaveTextContent("할 일 인라인 CRUD 편집기");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "편집기" })).not.toBeInTheDocument();
  });
});
