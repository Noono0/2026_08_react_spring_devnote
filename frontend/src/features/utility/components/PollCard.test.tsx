import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PollCard } from "@/features/utility/components/PollCard";
import type { Poll } from "@/features/utility/types/pollTypes";

const hiddenResultPoll: Poll = {
  pollId: 1,
  question: "점심 메뉴는?",
  status: "CLOSED",
  options: [{ optionId: 1, label: "짜장면", votes: null }, { optionId: 2, label: "짬뽕", votes: null }],
  totalSelections: null,
  participantCount: 4,
  participated: false,
  selectedOptionIds: [],
  allowMultiple: false,
  maxSelections: 1,
  realtimeResults: false,
  resultsVisible: false,
  manageableByCurrentUser: true,
  deletableByCurrentUser: true,
  createdBy: 1,
  creatorName: "관리자",
  endsAt: "2026-08-13T11:00:00.000Z",
  createdAt: "2026-08-13T10:00:00.000Z",
};

describe("PollCard", () => {
  it("비공개 투표는 득표 막대를 숨기고 작성자에게 결과 공개 단계를 제공한다", () => {
    render(<PollCard poll={hiddenResultPoll} selectedOptionIds={[]} votePending={false} statusPending={false} onSelectionChange={vi.fn()} onVote={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} />);

    expect(screen.queryByText(/표 ·/)).not.toBeInTheDocument();
    expect(screen.getAllByText("결과 비공개").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "결과 공개" })).toBeInTheDocument();
  });
});
