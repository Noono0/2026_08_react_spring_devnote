import { describe, expect, it } from "vitest";
import { highlightSegments, type SyntaxSegment } from "@/features/utility/utils/syntaxHighlighter";

/** 색이 있는 조각만 "종류:글자"로 모은다 */
const colored = (segments: SyntaxSegment[]): string[] => segments.filter((segment) => segment.type).map((segment) => `${segment.type}:${segment.text}`);

describe("문법 색칠 조각", () => {
  it("조각을 이으면 원문과 글자 하나까지 같다", () => {
    const source = "select u.id, 'a' -- 메모\nfrom users u where id = #{id}";
    expect(highlightSegments(source, "sql").map((segment) => segment.text).join("")).toBe(source);
  });

  it("SQL: 키워드·문자열·주석·숫자·MyBatis 파라미터를 나눈다", () => {
    expect(colored(highlightSegments("SELECT 'a' FROM t WHERE n = 10 AND id = #{id} -- 끝", "sql"))).toEqual([
      "keyword:SELECT", "string:'a'", "keyword:FROM", "keyword:WHERE", "number:10", "keyword:AND", "property:#{id}", "comment:-- 끝",
    ]);
  });

  it("JSON: 키(뒤에 :)와 값 문자열을 다른 색으로 칠한다", () => {
    expect(colored(highlightSegments('{"name": "DevNote", "ok": true, "count": 3}', "json"))).toEqual([
      'property:"name"', 'string:"DevNote"', 'property:"ok"', "keyword:true", 'property:"count"', "number:3",
    ]);
  });

  it("HTML: 태그·속성 이름·속성 값·주석을 나눈다", () => {
    expect(colored(highlightSegments('<!-- 메모 --><a class="x">링크</a>', "html"))).toEqual([
      "comment:<!-- 메모 -->", "tag:<a", "property:class", 'string:"x"', "tag:>", "tag:</a", "tag:>",
    ]);
  });

  it("CSS: 중괄호 안의 속성 이름만 속성 색, 밖의 선택자는 태그 색", () => {
    expect(colored(highlightSegments("a:hover{color:#fff;margin:2px}", "css"))).toEqual([
      "tag:a", "tag:{", "property:color", "number:#fff", "property:margin", "number:2px", "tag:}",
    ]);
  });

  it("Markdown: 제목·인라인 코드·굵게·목록 기호·링크", () => {
    expect(colored(highlightSegments("# 제목\n- `code` **굵게** [링크](https://a.b)", "markdown"))).toEqual([
      "heading:# 제목", "tag:-", "string:`code`", "keyword:**굵게**", "property:[링크](https://a.b)",
    ]);
  });

  it("모르는 언어나 빈 글은 색 없이 그대로 돌려준다", () => {
    expect(highlightSegments("plain", "unknown")).toEqual([{ text: "plain" }]);
    expect(highlightSegments("", "sql")).toEqual([]);
  });
});
