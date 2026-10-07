/**
 * crawlerFilters.ts — 수집 결과 표를 화면에서 거르는 규칙(서버에 다시 요청하지 않는다)
 *
 *   빠른 검색 : 모든 칸 중 하나라도 검색어를 포함하면 통과
 *   규칙 목록 : 칸 이름 + 연산자(포함·미포함·같음·이상·이하) + 값. ALL이면 모두, ANY면 하나라도 맞으면 통과
 * 금액 칸은 "1억 2천만원", "9,500만원" 같은 한글 표기를 숫자(원)로 바꿔 크기를 비교한다.
 */

import type { CrawlerFilterRule } from "@/features/crawler/types/webCrawlerTypes";

// "1억", "1억 2000", "1억 2천만" 모양 / "500만", "3천만원" 모양을 찾는 정규식.
const eokNumberPattern = /(-?\d+(?:\.\d+)?)\s*억(?:\s*(\d+(?:\.\d+)?)\s*(천|백|십)?\s*(만)?)?/;
const manNumberPattern = /(-?\d+(?:\.\d+)?)\s*(천|백|십)?\s*만(?:원)?/;

/** 만 앞에 붙은 단위를 원 단위 배수로: 천만 = 10,000,000 · 백만 = 1,000,000 · 십만 = 100,000 · 그냥 만 = 10,000 */
const manUnitMultiplier = (unit: string | undefined): number => {
  if (unit === "천") return 10_000_000;
  if (unit === "백") return 1_000_000;
  if (unit === "십") return 100_000;
  return 10_000;
};

/**
 * 비교용 숫자로 바꾼다. 예) "1억 2000" → 120,000,000 · "3천만원" → 30,000,000 · "25㎡" → 25
 * 억 뒤의 숫자에 단위가 없으면: 10 이상이면 만 단위(1억 2000 = 1억 2000만), 10 미만이면 그대로 더한다.
 * 숫자를 찾지 못하면 undefined(이 경우 크기 비교 규칙에서는 통과하지 못한다).
 */
export const parseComparableNumber = (rawValue: string): number | undefined => {
  const normalized = rawValue.replace(/,/g, "").trim();
  const eokMatch = eokNumberPattern.exec(normalized);
  if (eokMatch) {
    const eok = Number(eokMatch[1]) * 100_000_000;
    const remainderValue = Number(eokMatch[2] ?? 0);
    const remainderUnit = eokMatch[3];
    const hasManMarker = Boolean(eokMatch[4]);
    const multiplier = remainderUnit
      ? manUnitMultiplier(remainderUnit)
      : hasManMarker || remainderValue >= 10 ? 10_000 : 1;
    return eok + remainderValue * multiplier;
  }

  const manMatch = manNumberPattern.exec(normalized);
  if (manMatch) {
    return Number(manMatch[1]) * manUnitMultiplier(manMatch[2]);
  }

  const simpleMatch = /-?\d+(?:\.\d+)?/.exec(normalized);
  return simpleMatch ? Number(simpleMatch[0]) : undefined;
};

export const doesCrawlerItemMatchRule = (
  item: Record<string, string>,
  rule: CrawlerFilterRule,
): boolean => {
  const itemValue = item[rule.fieldName] ?? "";
  const normalizedItemValue = itemValue.toLocaleLowerCase("ko-KR");
  const normalizedFilterValue = rule.value.trim().toLocaleLowerCase("ko-KR");
  // 값을 비워 둔 규칙은 거르지 않는다(입력 중인 규칙 때문에 표가 비어 보이지 않게).
  if (!normalizedFilterValue) return true;

  if (rule.operator === "CONTAINS") return normalizedItemValue.includes(normalizedFilterValue);
  if (rule.operator === "NOT_CONTAINS") return !normalizedItemValue.includes(normalizedFilterValue);
  if (rule.operator === "EQUALS") return normalizedItemValue === normalizedFilterValue;

  const itemNumber = parseComparableNumber(itemValue);
  const filterNumber = parseComparableNumber(rule.value);
  if (itemNumber === undefined || filterNumber === undefined) return false;
  return rule.operator === "NUMBER_GTE" ? itemNumber >= filterNumber : itemNumber <= filterNumber;
};

export const filterCrawlerItems = (
  items: Array<Record<string, string>>,
  quickSearch: string,
  rules: CrawlerFilterRule[],
  matchMode: "ALL" | "ANY",
): Array<Record<string, string>> => {
  const normalizedQuickSearch = quickSearch.trim().toLocaleLowerCase("ko-KR");
  // 칸 이름과 값이 모두 채워진 규칙만 적용한다.
  const activeRules = rules.filter((rule) => rule.fieldName && rule.value.trim());
  return items.filter((item) => {
    const quickSearchMatches = !normalizedQuickSearch
      || Object.values(item).some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuickSearch));
    if (!quickSearchMatches) return false;
    if (activeRules.length === 0) return true;
    return matchMode === "ALL"
      ? activeRules.every((rule) => doesCrawlerItemMatchRule(item, rule))
      : activeRules.some((rule) => doesCrawlerItemMatchRule(item, rule));
  });
};
