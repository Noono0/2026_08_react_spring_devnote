import { applyMarkdownCommand } from "@/features/utility/utils/markdownEditorCommands";

describe("markdownEditorCommands", () => {
  it("선택한 텍스트에 인라인 서식을 적용하고 다시 누르면 해제한다", () => {
    const bold = applyMarkdownCommand("선택 글자", 0, 5, "BOLD");
    expect(bold.value).toBe("**선택 글자**");
    expect(bold).toMatchObject({ selectionStart: 2, selectionEnd: 7 });

    const unwrapped = applyMarkdownCommand(bold.value, bold.selectionStart, bold.selectionEnd, "BOLD");
    expect(unwrapped.value).toBe("선택 글자");
  });

  it("여러 줄을 H3 또는 순서 목록으로 변환한다", () => {
    const heading = applyMarkdownCommand("첫 줄\n## 둘째 줄", 0, 10, "HEADING_3");
    expect(heading.value).toBe("### 첫 줄\n### 둘째 줄");

    const ordered = applyMarkdownCommand("사과\n바나나\n포도", 0, 9, "ORDERED_LIST");
    expect(ordered.value).toBe("1. 사과\n2. 바나나\n3. 포도");
  });

  it("선택이 없으면 편집할 placeholder를 선택한다", () => {
    const link = applyMarkdownCommand("", 0, 0, "LINK");
    expect(link.value).toBe("[링크 텍스트](https://example.com)");
    expect(link.value.slice(link.selectionStart, link.selectionEnd)).toBe("링크 텍스트");
  });

  it("할 일 목록, 언어 코드 블록과 표를 삽입한다", () => {
    expect(applyMarkdownCommand("할 일", 0, 3, "TASK_LIST").value).toBe("- [ ] 할 일");
    expect(applyMarkdownCommand("const value = 1;", 0, 16, "CODE_BLOCK_JAVASCRIPT").value).toBe("```javascript\nconst value = 1;\n```");
    expect(applyMarkdownCommand("", 0, 0, "TABLE").value).toContain("| :--- | :---: | ---: |");
  });
});
