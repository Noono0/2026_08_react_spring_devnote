import { sanitizeRichTextHtml } from "@/shared/lib/sanitizeRichTextHtml";

describe("sanitizeRichTextHtml", () => {
  it("위험한 HTML을 제거하고 10열 초과 표를 한 화면용 조밀한 표로 표시한다", () => {
    const sanitizedHtml = sanitizeRichTextHtml(`
      <script>alert("위험")</script>
      <table><tbody><tr>
        ${Array.from({ length: 11 }, (_, index) => `<td>${index + 1}</td>`).join("")}
      </tr></tbody></table>
    `);
    const template = document.createElement("template");
    template.innerHTML = sanitizedHtml;
    const compactTable = template.content.querySelector<HTMLTableElement>("table");

    expect(sanitizedHtml).not.toContain("<script");
    expect(compactTable?.dataset.columnCount).toBe("11");
    expect(compactTable?.classList.contains("rich-table-compact")).toBe(true);
    expect(template.content.querySelector(".rich-table-scroll")).toBeNull();
  });
});
