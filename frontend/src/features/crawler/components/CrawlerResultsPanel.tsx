import { useMemo, useState } from "react";
import type {
  CrawlerFilterOperator,
  CrawlerFilterRule,
  CrawlerRunResponse,
} from "@/features/crawler/types/webCrawlerTypes";
import { filterCrawlerItems } from "@/features/crawler/utils/crawlerFilters";
import { createCrawlerCsvFileName, downloadCrawlerCsv } from "@/features/crawler/utils/crawlerCsv";
import {
  compareCrawlerResults,
  isAddedCrawlerItem,
  type CrawlerComparisonBaseline,
} from "@/features/crawler/utils/crawlerResultComparison";
import { createUuid } from "@/shared/lib/createUuid";

interface CrawlerResultsPanelProps {
  response: CrawlerRunResponse;
  /** 있으면 이 이전 실행과 비교해 새 항목을 표시하고 사라진 항목을 따로 보여 준다. */
  baseline?: CrawlerComparisonBaseline;
}

const filterOperatorLabels: Record<CrawlerFilterOperator, string> = {
  CONTAINS: "포함",
  NOT_CONTAINS: "포함하지 않음",
  EQUALS: "정확히 같음",
  NUMBER_GTE: "숫자 이상",
  NUMBER_LTE: "숫자 이하",
};

/** 새 거르기 규칙(기본: 그 칸에 값이 "포함"된 항목). id는 목록 key와 수정 대상 찾기에 쓴다. */
const createFilterRule = (fieldName: string): CrawlerFilterRule => ({
  id: createUuid(),
  fieldName,
  operator: "CONTAINS",
  value: "",
});

/**
 * 수집 결과 표. 빠른 검색·규칙 거르기(crawlerFilters.ts), 이전 실행과 비교(새 항목 표시·사라진 항목 목록), CSV 내려받기.
 * 거르기는 화면에서만 하므로 대상 사이트에 다시 요청하지 않는다.
 */
export const CrawlerResultsPanel = ({ response, baseline }: CrawlerResultsPanelProps) => {
  const [quickSearch, setQuickSearch] = useState("");
  const [filterRules, setFilterRules] = useState<CrawlerFilterRule[]>([]);
  const [filterMatchMode, setFilterMatchMode] = useState<"ALL" | "ANY">("ALL");
  const [addedOnly, setAddedOnly] = useState(false);
  // 두 결과(최대 500건씩)를 비교하는 계산이라 검색어를 입력할 때마다 다시 하지 않도록 결과가 바뀔 때만 계산한다.
  const comparison = useMemo(
    () => baseline ? compareCrawlerResults(response, baseline.response) : undefined,
    [baseline, response],
  );
  const visibleItems = useMemo(() => {
    const filteredItems = filterCrawlerItems(response.items, quickSearch, filterRules, filterMatchMode);
    return comparison && addedOnly ? filteredItems.filter((item) => isAddedCrawlerItem(item, comparison)) : filteredItems;
  }, [addedOnly, comparison, filterMatchMode, filterRules, quickSearch, response.items]);

  // 규칙 하나의 일부 값만 바꾼 새 배열로 교체한다(불변 갱신).
  const updateFilterRule = (ruleId: string, patch: Partial<CrawlerFilterRule>): void => {
    setFilterRules((currentRules) => currentRules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule));
  };

  return (
    <section className="crawler-results" aria-live="polite">
      <header className="crawler-results-header">
        <div><span className="page-kicker">Collected Data</span><h2>{response.pageTitle || "수집 결과"}</h2><p>{response.crawledPageCount}페이지 · {response.scannedItemCount}건 검사 · {response.items.length}건 수집 · {(response.durationMillis / 1000).toFixed(1)}초</p></div>
        <button type="button" className="secondary-button" disabled={visibleItems.length === 0} onClick={() => downloadCrawlerCsv(createCrawlerCsvFileName(), response.fieldNames, visibleItems)}>현재 결과 CSV</button>
      </header>
      {response.warnings.length > 0 ? <ul className="crawler-warning-list">{response.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}

      {baseline && comparison ? (
        <section className="crawler-comparison-summary" aria-label="이전 실행과 비교">
          <p>
            <strong>{baseline.label} 실행과 비교</strong>
            새 항목 <b>{comparison.addedCount}</b>건 · 그대로 {comparison.unchangedCount}건 · 사라진 항목 {comparison.removedItems.length}건
            <small>{comparison.keyFieldName ? `‘${comparison.keyFieldName}’ 칸이 같으면 같은 항목으로 봅니다.` : "링크 칸이 없어 상세내용·이미지주소를 뺀 나머지 칸 값이 모두 같으면 같은 항목으로 봅니다."}</small>
          </p>
          <label className="checkbox-label"><input type="checkbox" checked={addedOnly} onChange={(event) => setAddedOnly(event.target.checked)} /><span>새 항목만 보기</span></label>
          {comparison.removedItems.length > 0 ? (
            <details>
              <summary>사라진 항목 {comparison.removedItems.length}건 보기</summary>
              <ul className="crawler-removed-list">
                {comparison.removedItems.map((item, itemIndex) => {
                  const label = response.fieldNames.map((fieldName) => item[fieldName]).find((value) => value?.trim()) ?? "(빈 항목)";
                  // 수집한 값은 외부 사이트에서 온 데이터라 http(s) 주소일 때만 링크로 만든다(javascript: 주소 차단).
                  const rawLink = comparison.keyFieldName ? item[comparison.keyFieldName]?.trim() : undefined;
                  const link = rawLink && /^https?:\/\//i.test(rawLink) ? rawLink : undefined;
                  return <li key={`${link ?? label}-${itemIndex}`}>{link ? <a href={link} target="_blank" rel="noreferrer">{label} ↗</a> : label}</li>;
                })}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      <div className="crawler-filter-panel">
        <div className="crawler-filter-toolbar">
          <label>전체 빠른 검색<input aria-label="수집 결과 빠른 검색" value={quickSearch} onChange={(event) => setQuickSearch(event.target.value)} placeholder="모든 필드에서 검색" /></label>
          <label>조건 결합<select value={filterMatchMode} onChange={(event) => setFilterMatchMode(event.target.value as "ALL" | "ANY")}><option value="ALL">모든 조건 만족</option><option value="ANY">조건 중 하나 만족</option></select></label>
          <button type="button" className="secondary-button" onClick={() => setFilterRules((currentRules) => [...currentRules, createFilterRule(response.fieldNames[0] ?? "")])}>+ 검색 조건</button>
        </div>
        {filterRules.map((rule) => <div className="crawler-filter-row" key={rule.id}>
          <select aria-label="검색 필드" value={rule.fieldName} onChange={(event) => updateFilterRule(rule.id, { fieldName: event.target.value })}>{response.fieldNames.map((fieldName) => <option key={fieldName}>{fieldName}</option>)}</select>
          <select aria-label="검색 연산자" value={rule.operator} onChange={(event) => updateFilterRule(rule.id, { operator: event.target.value as CrawlerFilterOperator })}>{Object.entries(filterOperatorLabels).map(([operator, label]) => <option key={operator} value={operator}>{label}</option>)}</select>
          <input aria-label="검색 조건 값" value={rule.value} onChange={(event) => updateFilterRule(rule.id, { value: event.target.value })} placeholder={rule.operator.startsWith("NUMBER") ? "예: 120000000 또는 1억 2천" : "검색할 값"} />
          <button type="button" className="danger-button" aria-label="검색 조건 삭제" onClick={() => setFilterRules((currentRules) => currentRules.filter((currentRule) => currentRule.id !== rule.id))}>삭제</button>
        </div>)}
        <strong className="crawler-filter-count">전체 {response.items.length}건 중 {visibleItems.length}건 표시</strong>
      </div>

      {visibleItems.length === 0 ? <div className="portfolio-state-panel">검색 조건에 맞는 데이터가 없습니다.</div> : <div className="crawler-table-wrap"><table><caption>크롤링 결과</caption><thead><tr><th scope="col">#</th>{response.fieldNames.map((fieldName) => <th scope="col" key={fieldName}>{fieldName}</th>)}<th scope="col">출처</th></tr></thead><tbody>{visibleItems.map((item, itemIndex) => <tr key={`${item._pageUrl}-${itemIndex}`}><td>{itemIndex + 1}{comparison && isAddedCrawlerItem(item, comparison) ? <span className="crawler-new-badge">새 항목</span> : null}</td>{response.fieldNames.map((fieldName) => <td key={fieldName} className={fieldName === "상세내용" ? "crawler-detail-cell" : undefined}>{item[fieldName] || <span className="crawler-empty-value">비어 있음</span>}</td>)}<td><a href={item._pageUrl} target="_blank" rel="noreferrer">{item._pageNumber}페이지 ↗</a></td></tr>)}</tbody></table></div>}
    </section>
  );
};
