import { describe, expect, it } from "vitest";
import { createCrawlerCsvFileName, toCrawlerCsv } from "@/features/crawler/utils/crawlerCsv";

describe("크롤러 CSV 파일 이름", () => {
  it("기본 이름과 이전 기본 이름에 현지 날짜·시간을 붙인다", () => {
    const now = new Date(2026, 8, 27, 17, 5);
    for (const name of ["", "crawler-result", "crawler-results.csv"]) {
      expect(createCrawlerCsvFileName(name, now)).toBe("crawler-result 2026-09-27 17-05.csv");
    }
  });

  it("월·일·시·분을 두 자리로 표시하고 사용자 지정 이름을 보존한다", () => {
    expect(createCrawlerCsvFileName(" 매물:결과.CSV ", new Date(2027, 0, 2, 3, 4)))
      .toBe("매물_결과 2027-01-02 03-04.csv");
  });
});

describe("크롤러 CSV 내용", () => {
  it("필드 뒤에 출처 열을 붙이고 큰따옴표를 이스케이프한다", () => {
    const csv = toCrawlerCsv(["제목"], [
      { 제목: "\"급매\" 원룸, 2호선", _pageUrl: "https://example.com/list", _pageNumber: "1" },
      { 제목: "출처 없음" },
    ]);

    expect(csv.split("\r\n")).toEqual([
      "\"제목\",\"_pageUrl\",\"_pageNumber\"",
      "\"\"\"급매\"\" 원룸, 2호선\",\"https://example.com/list\",\"1\"",
      "\"출처 없음\",\"\",\"\"",
    ]);
  });
});
