import { describe, expect, it } from "vitest";
import { aggregateRows, groupRows, pivotRows, type GridAnalysisField } from "./gridAnalysis";

type Item = { region: string; kind: string; amount: number | null };
const region: GridAnalysisField<Item> = { key: "region", label: "지역", kind: "dimension", value: (row) => row.region };
const kind: GridAnalysisField<Item> = { key: "kind", label: "종류", kind: "dimension", value: (row) => row.kind };
const amount: GridAnalysisField<Item> = { key: "amount", label: "금액", kind: "measure", value: (row) => row.amount };
const items: Item[] = [
  { region: "서울", kind: "A", amount: 10 },
  { region: "서울", kind: "A", amount: 20 },
  { region: "서울", kind: "B", amount: null },
  { region: "부산", kind: "A", amount: 30 },
];

describe("공통 그리드 분석", () => {
  it("행 그룹을 두 단계로 만들고 각 그룹의 행 수를 계산한다", () => {
    const groups = groupRows(items, [region, kind], "count");
    expect(groups.find((group) => group.label === "서울")).toMatchObject({ count: 3, aggregate: 3 });
    expect(groups.find((group) => group.label === "서울")?.children.find((group) => group.label === "A")).toMatchObject({ count: 2, aggregate: 2 });
  });

  it("숫자 집계에서 비어 있는 값을 제외하고 평균을 낸다", () => {
    expect(aggregateRows(items, "count")).toBe(4);
    expect(aggregateRows(items, "sum", amount)).toBe(60);
    expect(aggregateRows(items, "average", amount)).toBe(20);
    expect(aggregateRows(items, "min", amount)).toBe(10);
    expect(aggregateRows(items, "max", amount)).toBe(30);
  });

  it("피벗의 평균 합계는 셀 평균의 합이 아니라 원본 데이터의 평균이다", () => {
    const pivot = pivotRows(items, region, kind, "average", amount);
    expect(pivot.columns).toEqual(["A", "B"]);
    expect(pivot.rows.find((row) => row.key === "서울")?.values).toEqual({ A: 15, B: 0 });
    expect(pivot.columnTotals.A).toBe(20);
    expect(pivot.total).toBe(20);
  });
});
