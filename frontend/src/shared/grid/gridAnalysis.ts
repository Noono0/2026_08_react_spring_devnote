/**
 * 무료 그리드와 함께 쓰는 독립적인 데이터 분석 함수.
 * AG Grid Enterprise의 그룹·피벗·집계 API를 호출하지 않고 원본 행 배열만 읽는다.
 * 다른 목록 화면에서는 필드 정의만 바꾸면 같은 함수를 재사용할 수 있다.
 */
export type Aggregation = "count" | "sum" | "average" | "min" | "max";

export interface GridAnalysisField<Row> {
  key: string;
  label: string;
  kind: "dimension" | "measure";
  value: (row: Row) => string | number | null | undefined;
}

export interface GroupedRow {
  key: string;
  label: string;
  count: number;
  aggregate: number;
  children: GroupedRow[];
}

export interface PivotRow {
  key: string;
  count: number;
  values: Record<string, number>;
  total: number;
}

export interface PivotResult {
  columns: string[];
  rows: PivotRow[];
  columnTotals: Record<string, number>;
  total: number;
}

const labelFor = <Row>(row: Row, field: GridAnalysisField<Row>): string => {
  const value = field.value(row);
  return value === null || value === undefined || value === "" ? "(빈 값)" : String(value);
};

/** 숫자 집계는 null·문자열·무한대를 제외한다. count는 실제 행 수를 센다. */
export const aggregateRows = <Row>(rows: Row[], aggregation: Aggregation, measure?: GridAnalysisField<Row>): number => {
  if (aggregation === "count") return rows.length;
  if (!measure) return 0;
  const values = rows.map((row) => measure.value(row)).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return 0;
  if (aggregation === "sum") return values.reduce((total, value) => total + value, 0);
  if (aggregation === "average") return values.reduce((total, value) => total + value, 0) / values.length;
  if (aggregation === "min") return values.reduce((minimum, value) => Math.min(minimum, value));
  return values.reduce((maximum, value) => Math.max(maximum, value));
};

/** 필드 순서대로 그룹 트리를 만든다. 각 노드는 자신의 행 수와 집계값을 갖는다. */
export const groupRows = <Row>(rows: Row[], dimensions: GridAnalysisField<Row>[], aggregation: Aggregation, measure?: GridAnalysisField<Row>): GroupedRow[] => {
  if (dimensions.length === 0) return [];
  const dimension = dimensions[0];
  if (!dimension) return [];
  const rest = dimensions.slice(1);
  const buckets = new Map<string, Row[]>();
  for (const row of rows) {
    const label = labelFor(row, dimension);
    const bucket = buckets.get(label) ?? [];
    bucket.push(row);
    buckets.set(label, bucket);
  }
  return [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right, "ko")).map(([label, items]) => ({
    key: `${dimension.key}:${label}`,
    label,
    count: items.length,
    aggregate: aggregateRows(items, aggregation, measure),
    children: groupRows(items, rest, aggregation, measure),
  }));
};

/** 두 차원의 교차표. 평균·최솟값·최댓값의 합계는 셀 값의 합이 아니라 원본 행에서 다시 계산한다. */
export const pivotRows = <Row>(rows: Row[], rowField: GridAnalysisField<Row>, columnField: GridAnalysisField<Row>, aggregation: Aggregation, measure?: GridAnalysisField<Row>): PivotResult => {
  const rowBuckets = new Map<string, Row[]>();
  const columnBuckets = new Map<string, Row[]>();
  for (const row of rows) {
    const rowKey = labelFor(row, rowField);
    const columnKey = labelFor(row, columnField);
    const rowBucket = rowBuckets.get(rowKey) ?? [];
    rowBucket.push(row);
    rowBuckets.set(rowKey, rowBucket);
    const columnBucket = columnBuckets.get(columnKey) ?? [];
    columnBucket.push(row);
    columnBuckets.set(columnKey, columnBucket);
  }
  const columns = [...columnBuckets.keys()].sort((left, right) => left.localeCompare(right, "ko"));
  const pivot = [...rowBuckets.entries()].sort(([left], [right]) => left.localeCompare(right, "ko")).map(([key, items]) => {
    const values: Record<string, number> = {};
    for (const column of columns) {
      values[column] = aggregateRows(items.filter((item) => labelFor(item, columnField) === column), aggregation, measure);
    }
    return { key, count: items.length, values, total: aggregateRows(items, aggregation, measure) };
  });
  const columnTotals = Object.fromEntries(columns.map((column) => [column, aggregateRows(columnBuckets.get(column) ?? [], aggregation, measure)]));
  return { columns, rows: pivot, columnTotals, total: aggregateRows(rows, aggregation, measure) };
};
