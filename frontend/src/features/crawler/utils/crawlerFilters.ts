import type { CrawlerFilterRule } from "@/features/crawler/types/webCrawlerTypes";

const eokNumberPattern = /(-?\d+(?:\.\d+)?)\s*억(?:\s*(\d+(?:\.\d+)?)\s*(천|백|십)?\s*(만)?)?/;
const manNumberPattern = /(-?\d+(?:\.\d+)?)\s*(천|백|십)?\s*만(?:원)?/;

const manUnitMultiplier = (unit: string | undefined): number => {
  if (unit === "천") return 10_000_000;
  if (unit === "백") return 1_000_000;
  if (unit === "십") return 100_000;
  return 10_000;
};

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
