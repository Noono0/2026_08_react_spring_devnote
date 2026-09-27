import { useMemo, useState } from "react";
import type {
  CrawlerFilterOperator,
  CrawlerFilterRule,
  CrawlerRunResponse,
} from "@/features/crawler/types/webCrawlerTypes";
import { filterCrawlerItems } from "@/features/crawler/utils/crawlerFilters";
import { createCrawlerCsvFileName, downloadCrawlerCsv } from "@/features/crawler/utils/crawlerCsv";
import { createUuid } from "@/shared/lib/createUuid";

interface CrawlerResultsPanelProps {
  response: CrawlerRunResponse;
}

const filterOperatorLabels: Record<CrawlerFilterOperator, string> = {
  CONTAINS: "포함",
  NOT_CONTAINS: "포함하지 않음",
  EQUALS: "정확히 같음",
  NUMBER_GTE: "숫자 이상",
  NUMBER_LTE: "숫자 이하",
};

const createFilterRule = (fieldName: string): CrawlerFilterRule => ({
  id: createUuid(),
  fieldName,
  operator: "CONTAINS",
  value: "",
});

export const CrawlerResultsPanel = ({ response }: CrawlerResultsPanelProps) => {
  const [quickSearch, setQuickSearch] = useState("");
  const [filterRules, setFilterRules] = useState<CrawlerFilterRule[]>([]);
  const [filterMatchMode, setFilterMatchMode] = useState<"ALL" | "ANY">("ALL");
  const visibleItems = useMemo(
    () => filterCrawlerItems(response.items, quickSearch, filterRules, filterMatchMode),
    [filterMatchMode, filterRules, quickSearch, response.items],
  );

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

      {visibleItems.length === 0 ? <div className="portfolio-state-panel">검색 조건에 맞는 데이터가 없습니다.</div> : <div className="crawler-table-wrap"><table><caption>크롤링 결과</caption><thead><tr><th scope="col">#</th>{response.fieldNames.map((fieldName) => <th scope="col" key={fieldName}>{fieldName}</th>)}<th scope="col">출처</th></tr></thead><tbody>{visibleItems.map((item, itemIndex) => <tr key={`${item._pageUrl}-${itemIndex}`}><td>{itemIndex + 1}</td>{response.fieldNames.map((fieldName) => <td key={fieldName} className={fieldName === "상세내용" ? "crawler-detail-cell" : undefined}>{item[fieldName] || <span className="crawler-empty-value">비어 있음</span>}</td>)}<td><a href={item._pageUrl} target="_blank" rel="noreferrer">{item._pageNumber}페이지 ↗</a></td></tr>)}</tbody></table></div>}
    </section>
  );
};
