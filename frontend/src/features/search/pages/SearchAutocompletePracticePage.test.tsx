import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchLearningTopics } from "@/features/search/api/localSearchApi";
import { SearchAutocompletePracticePage } from "./SearchAutocompletePracticePage";

vi.mock("@/features/search/api/localSearchApi", () => ({
  searchLearningTopics: vi.fn(),
}));

const mockedSearchLearningTopics = vi.mocked(searchLearningTopics);

describe("SearchAutocompletePracticePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedSearchLearningTopics.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("입력이 멈춘 뒤 검색하고 키보드로 결과를 선택한다", async () => {
    mockedSearchLearningTopics.mockResolvedValue([
      {
        topicId: 5,
        topicTitle: "Debounce 자동완성",
        categoryName: "비동기",
        description: "입력이 멈춘 뒤 검색합니다.",
        keywords: ["debounce", "검색"],
      },
    ]);
    render(<SearchAutocompletePracticePage />);

    const searchInput = screen.getByRole("combobox", { name: "학습 주제" });
    fireEvent.change(searchInput, { target: { value: "검색" } });

    expect(mockedSearchLearningTopics).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByRole("option", { name: /Debounce 자동완성/ })).toBeInTheDocument();
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(screen.getByRole("heading", { name: "Debounce 자동완성", level: 3 })).toBeInTheDocument();
    expect(searchInput).toHaveValue("Debounce 자동완성");
  });
});
