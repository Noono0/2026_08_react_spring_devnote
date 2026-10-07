/**
 * tableCellBackground.ts — 표 칸(td·th)에 배경색 속성을 더하는 Tiptap 확장
 * 기존 TableCell·TableHeader를 extend로 이어받아 속성 하나만 추가한다(나머지 동작은 그대로).
 */

import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

// #a1b2c3 같은 6자리 16진수 색만 허용한다. url(...)이나 다른 CSS가 섞여 들어오는 것을 막는다.
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
      // this.parent(): 원래 TableCell이 가진 속성들(colspan 등)을 먼저 그대로 가져온다.
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
