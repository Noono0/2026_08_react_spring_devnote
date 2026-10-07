import type { CrawlerRunResponse } from "@/features/crawler/types/webCrawlerTypes";
import { compareCrawlerResults, isAddedCrawlerItem } from "@/features/crawler/utils/crawlerResultComparison";

const createResponse = (fieldNames: string[], items: Record<string, string>[]): CrawlerRunResponse => ({
  crawledAt: "2026-10-04T00:00:00Z",
  pageTitle: "목록",
  finalUrl: "https://example.com/list",
  fieldNames,
  items: items.map((item) => ({ _pageUrl: "https://example.com/list", _pageNumber: "1", ...item })),
  crawledPageCount: 1,
  scannedItemCount: items.length,
  durationMillis: 1000,
  warnings: [],
});

describe("compareCrawlerResults", () => {
  it("링크가 같으면 제목이 바뀌어도 같은 글로 보고 새 글과 사라진 글만 찾는다", () => {
    const previous = createResponse(["제목", "링크"], [
      { 제목: "역세권 원룸", 링크: "https://example.com/1" },
      { 제목: "마감된 매물", 링크: "https://example.com/2" },
    ]);
    const current = createResponse(["제목", "링크"], [
      { 제목: "역세권 원룸 (가격 조정)", 링크: "https://example.com/1" },
      { 제목: "새 매물", 링크: "https://example.com/3" },
    ]);

    const comparison = compareCrawlerResults(current, previous);

    expect(comparison.keyFieldName).toBe("링크");
    expect(comparison.addedCount).toBe(1);
    expect(comparison.unchangedCount).toBe(1);
    expect(comparison.removedItems.map((item) => item.제목)).toEqual(["마감된 매물"]);
    expect(current.items.map((item) => isAddedCrawlerItem(item, comparison))).toEqual([false, true]);
  });

  it("링크 칸이 없으면 상세내용처럼 자주 바뀌는 칸을 빼고 나머지 값으로 비교한다", () => {
    const previous = createResponse(["제목", "작성자", "상세내용"], [{ 제목: "글", 작성자: "A", 상세내용: "이전 본문" }]);
    const current = createResponse(["제목", "작성자", "상세내용"], [
      { 제목: "글", 작성자: "A", 상세내용: "수정된 본문" },
      { 제목: "글", 작성자: "B", 상세내용: "" },
    ]);

    const comparison = compareCrawlerResults(current, previous);

    expect(comparison.keyFieldName).toBeNull();
    expect(comparison.addedCount).toBe(1);
    expect(comparison.removedItems).toHaveLength(0);
  });

  it("수집 칸 구성이 달라도 두 결과에 공통인 칸만 기준으로 비교한다", () => {
    const previous = createResponse(["제목", "URL"], [{ 제목: "글", URL: "https://example.com/1" }]);
    const current = createResponse(["제목", "URL", "보증금(만원)"], [
      { 제목: "글", URL: "https://example.com/1", "보증금(만원)": "1000" },
    ]);

    const comparison = compareCrawlerResults(current, previous);

    expect(comparison.keyFieldName).toBe("URL");
    expect(comparison.addedCount).toBe(0);
    expect(comparison.comparedFieldNames).toEqual(["제목", "URL"]);
  });
});
