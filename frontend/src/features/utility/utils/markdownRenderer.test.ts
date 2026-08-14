import { createMarkdownHtmlDocument, renderMarkdown } from "@/features/utility/utils/markdownRenderer";

describe("markdownRenderer", () => {
  it("제목, 목록, 코드 블록을 HTML로 변환한다", () => {
    const html = renderMarkdown("# 제목\n\n- 항목\n\n```ts\nconst value = 1;\n```");
    expect(html).toContain("<h1>제목</h1>");
    expect(html).toContain("<li>항목</li>");
    expect(html).toContain('class="language-ts"');
  });

  it("할 일 목록과 세 가지 가로선 문법을 렌더링한다", () => {
    const html = renderMarkdown("- [ ] 아직 안 한 일\n- [x] 이미 끝낸 일\n\n---\n***\n___");
    expect(html).toContain('class="markdown-task-list"');
    expect(html).toContain('aria-label="미완료"');
    expect(html).toContain('checked=""');
    expect(html.match(/<hr>/g)).toHaveLength(3);
  });

  it("표의 왼쪽·가운데·오른쪽 정렬을 렌더링한다", () => {
    const html = renderMarkdown("| 이름 | 나이 | 직업 |\n| :--- | :---: | ---: |\n| 민수 | 20 | 학생 |");
    expect(html).toContain("<table>");
    expect(html).toContain('<th class="align-left">이름</th>');
    expect(html).toContain('<th class="align-center">나이</th>');
    expect(html).toContain('<th class="align-right">직업</th>');
    expect(html).toContain('<td class="align-center">20</td>');
  });

  it("선택한 언어의 코드 토큰을 가볍게 강조한다", () => {
    const html = renderMarkdown("```javascript\nconst message = \"안녕하세요\";\n```");
    expect(html).toContain('data-language="javascript"');
    expect(html).toContain('<span class="syntax-keyword">const</span>');
    expect(html).toContain('<span class="syntax-string">"안녕하세요"</span>');
  });

  it("입력 HTML과 위험한 링크를 실행 가능한 HTML로 만들지 않는다", () => {
    const html = renderMarkdown('<script>alert("xss")</script>\n[링크](javascript:alert(1))');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
  });

  it("굵은 기울임·취소선·밑줄과 안전한 이미지를 렌더링한다", () => {
    const html = renderMarkdown("***강조*** ~~취소~~ <u>밑줄</u> ![설명](https://example.com/image.png)");
    expect(html).toContain("<strong><em>강조</em></strong>");
    expect(html).toContain("<del>취소</del>");
    expect(html).toContain("<u>밑줄</u>");
    expect(html).toContain('<img src="https://example.com/image.png" alt="설명" loading="lazy">');
  });

  it("독립 HTML 문서 제목을 escape한다", () => {
    expect(createMarkdownHtmlDocument('<script>', "<h1>본문</h1>")).toContain("&lt;script&gt;");
  });
});
