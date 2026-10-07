import DOMPurify from "dompurify";

/**
 * 저장된 리치 텍스트를 정화하고 표의 실제 논리 열 수를 표시합니다.
 * 10열을 초과한 표는 CSS에서 조밀한 한 화면 보기로 전환합니다.
 */
export const sanitizeRichTextHtml = (unsafeHtml: string): string => {
  // ★ DOMPurify: <script>, onerror= 같은 실행 가능한 코드를 HTML에서 지운다(XSS 방지). dangerouslySetInnerHTML 전에 반드시 거친다.
  const sanitizedHtml = DOMPurify.sanitize(unsafeHtml);
  // 브라우저가 아닌 환경(서버 렌더링 등)에는 document가 없으므로 정화만 하고 끝낸다.
  if (typeof document === "undefined") return sanitizedHtml;

  // <template>에 넣으면 화면에 붙이지 않고도 HTML을 DOM으로 다룰 수 있다(이미지 로딩·스크립트 실행도 일어나지 않는다).
  const template = document.createElement("template");
  template.innerHTML = sanitizedHtml;

  template.content.querySelectorAll("table").forEach((tableElement) => {
    // 각 줄의 칸 수(colSpan으로 합친 칸까지 계산) 중 가장 큰 값 = 표의 실제 열 수.
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
