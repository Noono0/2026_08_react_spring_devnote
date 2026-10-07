/**
 * tableRowHeight.ts — 표의 행(tr) 높이를 정하는 Tiptap 확장과 도우미 함수
 * 높이는 32~500px 정수만 허용한다(너무 작거나 큰 값, 이상한 문자열이 저장되는 것 방지).
 */

import type { Editor } from "@tiptap/core";
import TableRow from "@tiptap/extension-table-row";

export const TABLE_ROW_HEIGHT_MINIMUM = 32;
export const TABLE_ROW_HEIGHT_MAXIMUM = 500;
export const TABLE_ROW_HEIGHT_DEFAULT = 44;

/** 숫자 또는 "120"·"120px" 같은 글자를 받아, 허용 범위의 정수면 그 값을, 아니면 null(높이 없음)을 돌려준다. */
const normalizeTableRowHeight = (heightValue: unknown): number | null => {
  const parsedHeight =
    typeof heightValue === "number"
      ? heightValue
      : typeof heightValue === "string" && /^\d+(?:px)?$/.test(heightValue.trim())
        ? Number.parseInt(heightValue, 10)
        : Number.NaN;

  return Number.isInteger(parsedHeight)
    && parsedHeight >= TABLE_ROW_HEIGHT_MINIMUM
    && parsedHeight <= TABLE_ROW_HEIGHT_MAXIMUM
    ? parsedHeight
    : null;
};

/** 드래그로 바꾼 높이를 반올림하고 허용 범위 안으로 맞춘다(clamp = 최소·최대 사이로 자르기). */
export const clampTableRowHeight = (heightValue: number): number =>
  Math.min(
    TABLE_ROW_HEIGHT_MAXIMUM,
    Math.max(TABLE_ROW_HEIGHT_MINIMUM, Math.round(heightValue)),
  );

/**
 * 커서가 있는 칸의 행 높이를 읽는다(툴바 입력칸에 현재 값을 보여 줄 때).
 * $from.node(depth): 커서 위치에서 바깥쪽으로 한 단계씩 올라가며(칸 → 행 → 표) 행(tableRow)을 찾는다.
 */
export const getSelectedTableRowHeight = (editor: Editor): number | null => {
  const { $from } = editor.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const currentNode = $from.node(depth);
    if (currentNode.type.name === "tableRow") {
      return normalizeTableRowHeight(currentNode.attrs.rowHeight);
    }
  }

  return null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableRowHeight: {
      setTableRowHeight: (rowHeight: number | null) => ReturnType;
    };
  }
}

/**
 * 표 행에 높이를 저장하고 현재 셀이 포함된 행에 높이를 적용합니다.
 * HTML 표에서는 한 셀만 높아질 수 없으므로 같은 행의 모든 셀이 함께 조절됩니다.
 */
export const TableRowWithHeight = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rowHeight: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          normalizeTableRowHeight(
            element.getAttribute("data-row-height") ?? element.style.height,
          ),
        renderHTML: (attributes: Record<string, unknown>) => {
          const rowHeight = normalizeTableRowHeight(attributes.rowHeight);
          if (rowHeight === null) return {};

          return {
            "data-row-height": String(rowHeight),
            style: `height: ${rowHeight}px`,
          };
        },
      },
    };
  },

  addCommands() {
    return {
      setTableRowHeight:
        (rowHeight) =>
        ({ state, dispatch }) => {
          // null이면 높이 지우기. 숫자인데 허용 범위가 아니면 명령을 실행하지 않는다(false).
          const normalizedHeight = rowHeight === null ? null : normalizeTableRowHeight(rowHeight);
          if (rowHeight !== null && normalizedHeight === null) return false;

          // 선택 영역에 걸친 모든 행의 문서 위치를 모은다. Set이라 같은 행이 여러 번 들어와도 한 번만 처리한다.
          const selectedRowPositions = new Set<number>();
          const addAncestorRow = ($position: typeof state.selection.$from): void => {
            for (let depth = $position.depth; depth > 0; depth -= 1) {
              if ($position.node(depth).type.name === "tableRow") {
                selectedRowPositions.add($position.before(depth));
                return;
              }
            }
          };

          state.selection.ranges.forEach(({ $from, $to }) => {
            addAncestorRow($from);
            addAncestorRow($to);
          });
          state.doc.nodesBetween(state.selection.from, state.selection.to, (node, position) => {
            if (node.type.name === "tableRow") selectedRowPositions.add(position);
          });

          if (selectedRowPositions.size === 0) return false;
          // dispatch가 없으면 "실행할 수 있는지"만 묻는 호출(can())이므로 실제로 바꾸지 않고 true만 돌려준다.
          if (!dispatch) return true;

          // 트랜잭션: 여러 변경을 하나로 묶어 한 번에 적용한다(되돌리기 한 번에 모두 취소된다).
          const transaction = state.tr;
          selectedRowPositions.forEach((position) => {
            const rowNode = state.doc.nodeAt(position);
            if (!rowNode || rowNode.type.name !== "tableRow") return;

            transaction.setNodeMarkup(position, undefined, {
              ...rowNode.attrs,
              rowHeight: normalizedHeight,
            });
          });
          dispatch(transaction);
          return true;
        },
    };
  },
});
