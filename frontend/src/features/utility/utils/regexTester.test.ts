import { explainRegex, runJavaScriptRegex } from "@/features/utility/utils/regexTester";

describe("regexTester", () => {
  it("모든 일치 항목과 캡처 그룹 위치를 반환한다", () => {
    const result = runJavaScriptRegex("(?<word>[a-z]+)", "gi", "One TWO", "FIND");
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toMatchObject({ match: "One", start: 0, end: 3 });
    expect(result.matches[0]?.groups).toContainEqual({ name: "word", value: "One" });
  });

  it("치환 결과와 초보자 설명을 만든다", () => {
    expect(runJavaScriptRegex("\\d+", "g", "A1 B22", "REPLACE", "#").replacedText).toBe("A# B#");
    expect(explainRegex("^\\d+$").map((token) => token.description)).toContain("문자열의 시작");
  });
});

