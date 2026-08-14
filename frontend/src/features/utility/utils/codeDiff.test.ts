import { compareCode, createUnifiedPatch } from "@/features/utility/utils/codeDiff";

describe("codeDiff", () => {
  it("변경·추가·동일한 줄을 구분한다", () => {
    const rows = compareCode("const a = 1;\nkeep", "const a = 2;\nkeep\nadded", { ignoreWhitespace: false, ignoreCase: false });
    expect(rows.map((row) => row.type)).toEqual(["CHANGED", "EQUAL", "ADDED"]);
    expect(createUnifiedPatch("before.ts", "after.ts", rows)).toContain("+added");
  });

  it("공백 무시 옵션을 적용한다", () => {
    const rows = compareCode("const value = 1;", "const   value=1;", { ignoreWhitespace: true, ignoreCase: false });
    expect(rows[0]?.type).toBe("EQUAL");
  });
});

