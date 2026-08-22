import DOMPurify from "dompurify";

/**
 * 저장된 리치 텍스트를 정화하고 표의 실제 논리 열 수를 표시합니다.
 * 10열을 초과한 표는 CSS에서 조밀한 한 화면 보기로 전환합니다.
 */
export const sanitizeRichTextHtml = (unsafeHtml: string): string => {
  const sanitizedHtml = DOMPurify.sanitize(unsafeHtml);
  if (typeof document === "undefined") return sanitizedHtml;

  const template = document.createElement("template");
  template.innerHTML = sanitizedHtml;

  template.content.querySelectorAll("table").forEach((tableElement) => {
    const logicalColumnCount = Array.from(tableElement.rows).reduce(
      (largestColumnCount, tableRow) =>
        Math.max(
          largestColumnCount,
          Array.from(tableRow.cells).reduce(
            (columnCount, tableCell) => columnCount + tableCell.colSpan,
            0,
          ),
        ),
      0,
    );

    tableElement.dataset.columnCount = String(logicalColumnCount);
    tableElement.classList.toggle("rich-table-compact", logicalColumnCount > 10);
  });

  return template.innerHTML;
};
