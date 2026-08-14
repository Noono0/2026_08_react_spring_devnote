import { formatSource } from "@/features/utility/utils/sourceFormatter";

describe("formatSource", () => {
  it("JSON을 두 칸 들여쓰기로 정리한다", () => {
    expect(formatSource("JSON", '{"name":"DevNote"}')).toBe('{\n  "name": "DevNote"\n}');
  });

  it("빈 입력은 빈 결과를 반환한다", () => {
    expect(formatSource("SQL", "   ")).toBe("");
  });

  it("SQL 키워드를 대문자로 정리한다", () => {
    expect(formatSource("SQL", "select * from members where id = 1")).toContain("SELECT *\nFROM members\nWHERE id = 1");
  });
});
