/**
 * ============================================================================
 * crawlerResultComparison.ts — 두 번의 크롤링 결과를 비교해 새로 생긴·사라진 항목 찾기
 * ============================================================================
 *
 * 같은 설정을 다시 실행하면 대부분은 이미 본 글이다.
 * 이전 실행 결과와 비교해 "새로 올라온 것"과 "이번엔 안 보이는 것"만 골라낸다.
 * 저장된 실행 이력끼리 비교하므로 대상 사이트에 요청을 더 보내지 않는다.
 *
 * [같은 항목인지 어떻게 판단하나?]
 *   1. 두 결과에 모두 링크 칸(링크·link·url·href)이 있으면 그 주소로 비교한다.
 *      제목이 조금 바뀌어도 같은 글로 본다.
 *   2. 링크 칸이 없으면 수집한 칸의 값을 모두 이어 붙여 비교한다.
 *      이때 상세내용·이미지주소처럼 길고 자주 바뀌는 칸은 빼고 비교한다.
 *
 * [Set을 쓰는 이유]
 *   "이 키가 이전 결과에 있었나?"를 항목마다 묻는다.
 *   배열 includes는 매번 처음부터 끝까지 훑지만 Set.has는 바로 찾는다.
 *   500건끼리 비교하면 includes는 최대 25만 번, Set은 500번만 확인한다.
 */

import type { CrawlerRunResponse } from "@/features/crawler/types/webCrawlerTypes";

type CrawlerItem = CrawlerRunResponse["items"][number];

/** 링크로 쓸 수 있는 칸 이름. 대소문자는 구분하지 않는다. */
const LINK_FIELD_NAMES = ["링크", "link", "url", "href"];
/** 값이 길거나 실행마다 달라질 수 있어 "같은 항목" 판단에서 빼는 칸 */
const VOLATILE_FIELD_NAMES = new Set(["상세내용", "이미지주소"]);

/** 비교 기준이 되는 이전 실행. label은 화면에 "어떤 실행과 비교했는지" 보여 줄 문구다. */
export interface CrawlerComparisonBaseline {
  label: string;
  response: CrawlerRunResponse;
}

export interface CrawlerResultComparison {
  /** 비교에 사용한 링크 칸. 없으면 null(모든 칸 값으로 비교) */
  keyFieldName: string | null;
  /** 두 결과에 모두 있어 비교 기준이 된 칸 */
  comparedFieldNames: readonly string[];
  /** 이번 결과의 항목 중 새로 생긴 항목의 키 */
  addedKeys: ReadonlySet<string>;
  addedCount: number;
  /** 이전 결과에는 있었지만 이번에는 없는 항목 */
  removedItems: CrawlerItem[];
  unchangedCount: number;
}

export const findLinkFieldName = (fieldNames: readonly string[]): string | null =>
  fieldNames.find((fieldName) => LINK_FIELD_NAMES.includes(fieldName.trim().toLowerCase())) ?? null;

export const createCrawlerItemKey = (
  item: CrawlerItem,
  fieldNames: readonly string[],
  keyFieldName: string | null,
): string => {
  if (keyFieldName) {
    const linkValue = item[keyFieldName]?.trim();
    // 링크가 비어 있는 행은 링크만으로 구분할 수 없으므로 아래 "모든 칸" 방식으로 넘어간다.
    if (linkValue) return `link:${linkValue}`;
  }
  const values = fieldNames
    .filter((fieldName) => !VOLATILE_FIELD_NAMES.has(fieldName))
    .map((fieldName) => (item[fieldName] ?? "").trim());
  // JSON 문자열로 만들면 "a|b" + "c" 와 "a" + "b|c" 처럼 구분자가 겹치는 경우도 서로 다른 키가 된다.
  return `values:${JSON.stringify(values)}`;
};

/**
 * current(이번 실행)를 previous(이전 실행)와 비교한다.
 * 두 결과의 수집 칸 구성이 다르면 같은 칸만 기준으로 삼는다.
 */
export const compareCrawlerResults = (
  current: CrawlerRunResponse,
  previous: CrawlerRunResponse,
): CrawlerResultComparison => {
  const sharedFieldNames = current.fieldNames.filter((fieldName) => previous.fieldNames.includes(fieldName));
  const keyFieldName = findLinkFieldName(sharedFieldNames);
  const toKey = (item: CrawlerItem) => createCrawlerItemKey(item, sharedFieldNames, keyFieldName);

  const previousKeys = new Set(previous.items.map(toKey));
  const currentKeys = new Set(current.items.map(toKey));

  const addedKeys = new Set<string>();
  let addedCount = 0;
  let unchangedCount = 0;
  current.items.forEach((item) => {
    const key = toKey(item);
    if (previousKeys.has(key)) {
      unchangedCount++;
    } else {
      addedKeys.add(key);
      addedCount++;
    }
  });

  return {
    keyFieldName,
    comparedFieldNames: sharedFieldNames,
    addedKeys,
    addedCount,
    removedItems: previous.items.filter((item) => !currentKeys.has(toKey(item))),
    unchangedCount,
  };
};

/** 결과 표에서 한 행이 "새 항목"인지 확인할 때 쓴다. compareCrawlerResults와 같은 키 규칙을 쓴다. */
export const isAddedCrawlerItem = (item: CrawlerItem, comparison: CrawlerResultComparison): boolean =>
  comparison.addedKeys.has(createCrawlerItemKey(item, comparison.comparedFieldNames, comparison.keyFieldName));
