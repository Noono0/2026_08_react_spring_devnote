import { useState } from "react";
import { aggregateRows, groupRows, pivotRows, type Aggregation, type GridAnalysisField, type GroupedRow } from "./gridAnalysis";

const aggregationLabels: Record<Aggregation, string> = {
  count: "건수", sum: "합계", average: "평균", min: "최솟값", max: "최댓값",
};
const formatNumber = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

/**
 * 펼침/접힘은 브라우저의 details로 처리해 키보드도 사용할 수 있다.
 * 그룹 계산은 gridAnalysis.ts에 있으므로 다른 데이터 그리드도 이 화면만 가져다 쓰면 된다.
 */
const GroupTree = ({ groups, suffix, countOnly }: { groups: GroupedRow[]; suffix: string; countOnly: boolean }) => <ul className="grid-analysis-groups">
  {groups.map((group) => <li key={group.key}>
    {group.children.length ? <details><summary>{group.label} · {group.count}건{countOnly ? "" : ` · ${formatNumber(group.aggregate)}${suffix}`}</summary><GroupTree groups={group.children} suffix={suffix} countOnly={countOnly} /></details>
      : <span>{group.label} · {group.count}건{countOnly ? "" : ` · ${formatNumber(group.aggregate)}${suffix}`}</span>}
  </li>)}
</ul>;

/** 원본 데이터와 같은 집계 결과를 그리드 바로 아래에 SVG 막대 차트로 표시한다. */
const InlineChart = ({ groups, suffix }: { groups: GroupedRow[]; suffix: string }) => {
  if (!groups.length) return <p>차트에 표시할 데이터가 없습니다.</p>;
  const max = groups.reduce((maximum, group) => Math.max(maximum, Math.abs(group.aggregate)), 1);
  const height = Math.max(100, groups.length * 38 + 14);
  return <svg className="grid-analysis-chart" role="img" aria-label="그룹별 집계 막대 차트" viewBox={`0 0 610 ${height}`}>
    <title>그룹별 집계 막대 차트</title>
    {groups.map((group, index) => <g key={group.key} transform={`translate(0 ${index * 38 + 8})`}>
      <text x="4" y="21" className="grid-analysis-chart-label">{group.label.length > 13 ? `${group.label.slice(0, 12)}…` : group.label}</text>
      <rect x="158" y="3" width={Math.max(2, Math.abs(group.aggregate) / max * 350)} height="25" rx="5" className={group.aggregate < 0 ? "grid-analysis-negative" : "grid-analysis-positive"} />
      <text x="518" y="21" className="grid-analysis-chart-value">{formatNumber(group.aggregate)}{suffix}</text>
    </g>)}
  </svg>;
};

export const GridAnalysisPanel = <Row,>({ rows, fields }: { rows: Row[]; fields: GridAnalysisField<Row>[] }) => {
  const dimensions = fields.filter((field) => field.kind === "dimension");
  const measures = fields.filter((field) => field.kind === "measure");
  const [groupKey, setGroupKey] = useState(dimensions[0]?.key ?? "");
  const [secondGroupKey, setSecondGroupKey] = useState("");
  const [pivotRowKey, setPivotRowKey] = useState(dimensions[0]?.key ?? "");
  const [pivotColumnKey, setPivotColumnKey] = useState(dimensions[1]?.key ?? dimensions[0]?.key ?? "");
  const [aggregation, setAggregation] = useState<Aggregation>("count");
  const [measureKey, setMeasureKey] = useState(measures[0]?.key ?? "");
  const groupField = dimensions.find((field) => field.key === groupKey) ?? dimensions[0];
  const secondGroupField = dimensions.find((field) => field.key === secondGroupKey);
  const pivotRowField = dimensions.find((field) => field.key === pivotRowKey) ?? dimensions[0];
  const pivotColumnField = dimensions.find((field) => field.key === pivotColumnKey) ?? dimensions[0];
  const measure = measures.find((field) => field.key === measureKey);

  if (!groupField || !pivotRowField || !pivotColumnField) return <p>분석할 범주 필드가 없습니다.</p>;
  const groupingFields = secondGroupField && secondGroupField.key !== groupField.key ? [groupField, secondGroupField] : [groupField];
  const groups = groupRows(rows, groupingFields, aggregation, measure);
  const chartGroups = groupRows(rows, [groupField], aggregation, measure);
  const pivot = pivotRows(rows, pivotRowField, pivotColumnField, aggregation, measure);
  const suffix = aggregation === "count" ? "건" : "";

  return <details className="grid-analysis-panel"><summary>그룹 · 피벗 · 집계 · 차트</summary>
    <p>현재 목록에 표시된 {rows.length}건을 분석합니다. 그리드 검색과 열 필터를 바꾸면 결과도 갱신됩니다.</p>
    <div className="grid-analysis-controls">
      <label>첫 번째 그룹<select value={groupKey} onChange={(event) => setGroupKey(event.target.value)}>{dimensions.map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}</select></label>
      <label>두 번째 그룹<select value={secondGroupKey} onChange={(event) => setSecondGroupKey(event.target.value)}><option value="">선택 안 함</option>{dimensions.map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}</select></label>
      <label>집계 방식<select value={aggregation} onChange={(event) => setAggregation(event.target.value as Aggregation)}>{(Object.keys(aggregationLabels) as Aggregation[]).filter((item) => item === "count" || measures.length > 0).map((item) => <option value={item} key={item}>{aggregationLabels[item]}</option>)}</select></label>
      {measures.length ? <label>숫자 필드<select value={measureKey} onChange={(event) => setMeasureKey(event.target.value)}>{measures.map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}</select></label> : null}
    </div>
    <p className="grid-analysis-total">전체 {rows.length}건 · {aggregationLabels[aggregation]} {formatNumber(aggregateRows(rows, aggregation, measure))}{suffix}</p>
    <div className="grid-analysis-layout"><section><h3>행 그룹핑</h3>{groups.length ? <GroupTree groups={groups} suffix={suffix} countOnly={aggregation === "count"} /> : <p>표시할 데이터가 없습니다.</p>}</section>
      <section><h3>인라인 차트</h3><InlineChart groups={chartGroups} suffix={suffix} /></section></div>
    <section><h3>피벗 테이블</h3><div className="grid-analysis-controls">
      <label>행 기준<select value={pivotRowKey} onChange={(event) => setPivotRowKey(event.target.value)}>{dimensions.map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}</select></label>
      <label>열 기준<select value={pivotColumnKey} onChange={(event) => setPivotColumnKey(event.target.value)}>{dimensions.map((field) => <option value={field.key} key={field.key}>{field.label}</option>)}</select></label>
    </div><div className="grid-analysis-pivot-wrap"><table><thead><tr><th scope="col">{pivotRowField.label} / {pivotColumnField.label}</th>{pivot.columns.map((column) => <th scope="col" key={column}>{column}</th>)}<th scope="col">전체</th></tr></thead>
      <tbody>{pivot.rows.map((row) => <tr key={row.key}><th scope="row">{row.key}</th>{pivot.columns.map((column) => <td key={column}>{formatNumber(row.values[column] ?? 0)}</td>)}<td>{formatNumber(row.total)}</td></tr>)}</tbody>
      <tfoot><tr><th scope="row">전체</th>{pivot.columns.map((column) => <td key={column}>{formatNumber(pivot.columnTotals[column] ?? 0)}</td>)}<td>{formatNumber(pivot.total)}</td></tr></tfoot></table></div></section>
  </details>;
};
