import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PollListView } from "@/features/utility/components/PollListView";
import type { Poll } from "@/features/utility/types/pollTypes";

const poll: Poll = {
  pollId: 7,
  question: "점심 메뉴는?",
  status: "OPEN",
  options: [{ optionId: 1, label: "짜장면", votes: 2 }, { optionId: 2, label: "짬뽕", votes: 1 }],
  totalSelections: 3,
  participantCount: 3,
  participated: false,
  selectedOptionIds: [],
  allowMultiple: false,
  maxSelections: 1,
  realtimeResults: true,
  resultsVisible: true,
  manageableByCurrentUser: true,
  deletableByCurrentUser: true,
  createdBy: 1,
  creatorName: "관리자",
  endsAt: "2026-08-13T11:00:00.000Z",
  createdAt: "2026-08-13T10:00:00.000Z",
};

describe("PollListView", () => {
  it("요약 정보를 표시하고 관리자 삭제 동작을 전달한다", () => {
    const deletePoll = vi.fn();
    render(<PollListView polls={[poll]} onDetailOpen={vi.fn()} onDelete={deletePoll} />);

    expect(screen.getByText((_content, element) => element?.getAttribute("data-label") === "문항" && element.textContent === "2개 문항")).toBeInTheDocument();
    expect(screen.getByText((_content, element) => element?.getAttribute("data-label") === "참여" && element.textContent === "3명 참여")).toBeInTheDocument();
    expect(screen.getByText((_content, element) => element?.getAttribute("data-label") === "투표됨" && element.textContent === "3개 투표됨")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(deletePoll).toHaveBeenCalledWith(poll);
  });
});
