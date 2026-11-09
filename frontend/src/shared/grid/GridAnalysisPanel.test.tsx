import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GridAnalysisPanel } from "./GridAnalysisPanel";
import type { GridAnalysisField } from "./gridAnalysis";

type Item = { city: string; type: string; amount: number };
const fields: GridAnalysisField<Item>[] = [
  { key: "city", label: "도시", kind: "dimension", value: (row) => row.city },
  { key: "type", label: "종류", kind: "dimension", value: (row) => row.type },
  { key: "amount", label: "금액", kind: "measure", value: (row) => row.amount },
];
const rows: Item[] = [
  { city: "서울", type: "A", amount: 10 },
  { city: "서울", type: "B", amount: 20 },
  { city: "부산", type: "A", amount: 30 },
];

describe("GridAnalysisPanel", () => {
  it("그룹·피벗·차트가 같은 행 수를 사용하고 집계 방식을 바꿀 수 있다", () => {
    render(<GridAnalysisPanel rows={rows} fields={fields} />);
    fireEvent.click(screen.getByText("그룹 · 피벗 · 집계 · 차트"));

    expect(screen.getByText("전체 3건 · 건수 3건")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "그룹별 집계 막대 차트" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("집계 방식"), { target: { value: "sum" } });
    expect(screen.getByText("전체 3건 · 합계 60")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument();
  });
});
