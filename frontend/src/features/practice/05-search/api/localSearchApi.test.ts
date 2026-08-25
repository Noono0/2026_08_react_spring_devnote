import { afterEach, describe, expect, it, vi } from "vitest";
import { searchLearningTopics } from "./localSearchApi";

describe("searchLearningTopics", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("제목·설명·키워드에서 검색어와 일치하는 학습 주제를 반환한다", async () => {
    vi.useFakeTimers();
    const abortController = new AbortController();
    const searchPromise = searchLearningTopics("검색", "success", abortController.signal);

    await vi.advanceTimersByTimeAsync(500);
    const searchResults = await searchPromise;

    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some((result) => result.topicTitle.includes("검색"))).toBe(true);
  });

  it("요청이 취소되면 AbortError를 반환한다", async () => {
    vi.useFakeTimers();
    const abortController = new AbortController();
    const searchPromise = searchLearningTopics("상태", "slow", abortController.signal);

    abortController.abort();

    await expect(searchPromise).rejects.toMatchObject({ name: "AbortError" });
  });
});

