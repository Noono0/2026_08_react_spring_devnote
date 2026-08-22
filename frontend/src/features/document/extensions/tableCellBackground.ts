import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

const SAFE_HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const normalizeCellBackgroundColor = (colorValue: unknown): string | null =>
  typeof colorValue === "string" && SAFE_HEX_COLOR_PATTERN.test(colorValue)
    ? colorValue.toLowerCase()
    : null;

const cellBackgroundAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) =>
    normalizeCellBackgroundColor(element.getAttribute("data-background-color")),
  renderHTML: (attributes: Record<string, unknown>) => {
    const backgroundColor = normalizeCellBackgroundColor(attributes.backgroundColor);
    if (!backgroundColor) return {};

    // data 속성은 다시 편집할 때 정확한 HEX 값을 복원하고,
    // style 속성은 저장된 HTML을 읽기 전용 화면에서도 같은 색으로 보여 줍니다.
    return {
      "data-background-color": backgroundColor,
      style: `background-color: ${backgroundColor}`,
    };
  },
};

/** 일반 셀(td)에 배경색 속성을 추가한 Tiptap 확장입니다. */
export const TableCellWithBackground = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: cellBackgroundAttribute,
    };
  },
});

/** 머리글 셀(th)도 일반 셀과 같은 방식으로 배경색을 저장합니다. */
export const TableHeaderWithBackground = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: cellBackgroundAttribute,
    };
  },
});
