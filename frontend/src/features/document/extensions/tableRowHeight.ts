import type { Editor } from "@tiptap/core";
import TableRow from "@tiptap/extension-table-row";

export const TABLE_ROW_HEIGHT_MINIMUM = 32;
export const TABLE_ROW_HEIGHT_MAXIMUM = 500;
export const TABLE_ROW_HEIGHT_DEFAULT = 44;

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

export const clampTableRowHeight = (heightValue: number): number =>
  Math.min(
    TABLE_ROW_HEIGHT_MAXIMUM,
    Math.max(TABLE_ROW_HEIGHT_MINIMUM, Math.round(heightValue)),
  );

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
          const normalizedHeight = rowHeight === null ? null : normalizeTableRowHeight(rowHeight);
          if (rowHeight !== null && normalizedHeight === null) return false;

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
          if (!dispatch) return true;

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
