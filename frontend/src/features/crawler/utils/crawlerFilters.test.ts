import { describe, expect, it } from "vitest";
import type { CrawlerFilterRule } from "@/features/crawler/types/webCrawlerTypes";
import { filterCrawlerItems, parseComparableNumber } from "./crawlerFilters";

const rule = (
  fieldName: string,
  operator: CrawlerFilterRule["operator"],
  value: string,
): CrawlerFilterRule => ({ id: `${fieldName}-${operator}`, fieldName, operator, value });

describe("crawlerFilters", () => {
  const items = [
    { 제목: "공공임대 2호선 인근", 지역: "신림", 보증금: "1억 3천" },
    { 제목: "일반 월세", 지역: "화정", 보증금: "8천만원" },
  ];

  it("모든 필드 빠른 검색과 AND 조건을 함께 적용한다", () => {
    expect(filterCrawlerItems(items, "2호선", [
      rule("지역", "CONTAINS", "신림"),
      rule("보증금", "NUMBER_LTE", "1억 5천"),
    ], "ALL")).toEqual([items[0]]);
  });

  it("OR 조건에서는 하나의 규칙만 맞아도 남긴다", () => {
    expect(filterCrawlerItems(items, "", [
      rule("지역", "EQUALS", "강남"),
      rule("지역", "EQUALS", "화정"),
    ], "ANY")).toEqual([items[1]]);
  });

  it("한국어 억 단위 금액을 비교 가능한 숫자로 바꾼다", () => {
    expect(parseComparableNumber("보증금 1억 2천만원")).toBe(120_000_000);
    expect(parseComparableNumber("보증금 8천만원")).toBe(80_000_000);
    expect(parseComparableNumber("월세 70만원")).toBe(700_000);
  });
});
