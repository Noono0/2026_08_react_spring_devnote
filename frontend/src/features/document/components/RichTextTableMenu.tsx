import { useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { Editor } from "@tiptap/core";
import {
  clampTableRowHeight,
  getSelectedTableRowHeight,
  TABLE_ROW_HEIGHT_DEFAULT,
  TABLE_ROW_HEIGHT_MAXIMUM,
  TABLE_ROW_HEIGHT_MINIMUM,
} from "@/features/document/extensions/tableRowHeight";

const TABLE_PICKER_GRID_SIZE = 10;
const TABLE_DIRECT_INPUT_MAXIMUM = 50;
const CELL_BACKGROUND_PALETTE = [
  { color: "#fff3a3", label: "연한 노랑" },
  { color: "#ffd8a8", label: "연한 주황" },
  { color: "#ffc9c9", label: "연한 빨강" },
  { color: "#d3f9d8", label: "연한 초록" },
  { color: "#d0ebff", label: "연한 파랑" },
  { color: "#e5dbff", label: "연한 보라" },
  { color: "#f1f3f5", label: "연한 회색" },
  { color: "#ffffff", label: "흰색" },
] as const;

interface TableSize {
  rows: number;
  columns: number;
}

interface RichTextTableMenuProperties {
  editor: Editor;
  isInsideTable: boolean;
}

const closeTableMenu = (element: HTMLElement): void => {
  element.closest("details")?.removeAttribute("open");
};

/**
 * Office 계열 편집기처럼 격자 위를 움직여 표 크기를 고르는 메뉴입니다.
 * 10×10보다 큰 표는 아래 숫자 입력으로 만들 수 있습니다.
 */
export const RichTextTableMenu = ({ editor, isInsideTable }: RichTextTableMenuProperties) => {
  const [selectedSize, setSelectedSize] = useState<TableSize>({ rows: 1, columns: 1 });
  const [directRows, setDirectRows] = useState(3);
  const [directColumns, setDirectColumns] = useState(3);
  const [withHeaderRow, setWithHeaderRow] = useState(true);
  const [customCellBackgroundColor, setCustomCellBackgroundColor] = useState("#fff3a3");
  const currentCellBackgroundColor = String(
    editor.getAttributes(editor.isActive("tableHeader") ? "tableHeader" : "tableCell").backgroundColor ?? "",
  );
  const currentTableRowHeight = getSelectedTableRowHeight(editor) ?? TABLE_ROW_HEIGHT_DEFAULT;

  const insertTable = (rows: number, columns: number, sourceElement: HTMLElement): void => {
    editor.chain().focus().insertTable({ rows, cols: columns, withHeaderRow }).run();
    closeTableMenu(sourceElement);
  };

  const focusGridCell = (
    currentCell: HTMLButtonElement,
    rows: number,
    columns: number,
  ): void => {
    const gridElement = currentCell.closest('[role="grid"]');
    gridElement
      ?.querySelector<HTMLButtonElement>(
        `[data-table-row="${rows}"][data-table-column="${columns}"]`,
      )
      ?.focus();
  };

  const handleGridKeyDown = (
    keyboardEvent: KeyboardEvent<HTMLButtonElement>,
    rows: number,
    columns: number,
  ): void => {
    let nextRows = rows;
    let nextColumns = columns;

    if (keyboardEvent.key === "ArrowRight") nextColumns = Math.min(TABLE_PICKER_GRID_SIZE, columns + 1);
    else if (keyboardEvent.key === "ArrowLeft") nextColumns = Math.max(1, columns - 1);
    else if (keyboardEvent.key === "ArrowDown") nextRows = Math.min(TABLE_PICKER_GRID_SIZE, rows + 1);
    else if (keyboardEvent.key === "ArrowUp") nextRows = Math.max(1, rows - 1);
    else if (keyboardEvent.key === "Home") {
      nextRows = 1;
      nextColumns = 1;
    } else if (keyboardEvent.key === "End") {
      nextRows = TABLE_PICKER_GRID_SIZE;
      nextColumns = TABLE_PICKER_GRID_SIZE;
    } else return;

    keyboardEvent.preventDefault();
    setSelectedSize({ rows: nextRows, columns: nextColumns });
    focusGridCell(keyboardEvent.currentTarget, nextRows, nextColumns);
  };

  const handleDirectTableSubmit = (formEvent: FormEvent<HTMLFormElement>): void => {
    formEvent.preventDefault();
    insertTable(directRows, directColumns, formEvent.currentTarget);
  };

  const runTableEditCommand = (
    mouseEvent: MouseEvent<HTMLButtonElement>,
    command: () => boolean,
  ): void => {
    command();
    closeTableMenu(mouseEvent.currentTarget);
  };

  const applyCellBackgroundColor = (backgroundColor: string | null): void => {
    if (!isInsideTable) return;
    editor.chain().focus().setCellAttribute("backgroundColor", backgroundColor).run();
  };

  const applyTableRowHeight = (rowHeight: number): void => {
    if (!isInsideTable) return;
    editor.chain().focus().setTableRowHeight(clampTableRowHeight(rowHeight)).run();
  };

  return (
    <details className="editor-toolbar-menu">
      <summary
        className={`editor-tool-button ${isInsideTable ? "active" : ""}`}
        aria-label="표 도구"
        title="표 도구"
      >
        ▦
      </summary>

      <div className="editor-toolbar-menu-panel editor-table-menu-panel">
        <section className="editor-table-insert-section" aria-labelledby="editor-table-insert-title">
          <div className="editor-table-picker-heading">
            <strong id="editor-table-insert-title">표 삽입</strong>
            <span aria-live="polite">
              {selectedSize.columns}열 × {selectedSize.rows}행
            </span>
          </div>

          <div
            className="editor-table-size-grid"
            role="grid"
            aria-label="표 행과 열 크기 선택"
            aria-rowcount={TABLE_PICKER_GRID_SIZE}
            aria-colcount={TABLE_PICKER_GRID_SIZE}
          >
            {Array.from({ length: TABLE_PICKER_GRID_SIZE }, (_, rowIndex) => {
              const rows = rowIndex + 1;
              return (
                <div key={rows} className="editor-table-size-row" role="row">
                  {Array.from({ length: TABLE_PICKER_GRID_SIZE }, (__, columnIndex) => {
                    const columns = columnIndex + 1;
                    const isWithinSelection = rows <= selectedSize.rows && columns <= selectedSize.columns;
                    const isActiveCell = rows === selectedSize.rows && columns === selectedSize.columns;
                    return (
                      <button
                        key={`${rows}-${columns}`}
                        type="button"
                        role="gridcell"
                        className={`editor-table-size-cell${isWithinSelection ? " selected" : ""}${isActiveCell ? " active" : ""}`}
                        aria-label={`${columns}열 ${rows}행 표 삽입`}
                        aria-selected={isActiveCell}
                        tabIndex={isActiveCell ? 0 : -1}
                        data-table-row={rows}
                        data-table-column={columns}
                        onMouseEnter={() => setSelectedSize({ rows, columns })}
                        onFocus={() => setSelectedSize({ rows, columns })}
                        onKeyDown={(event) => handleGridKeyDown(event, rows, columns)}
                        onClick={(event) => insertTable(rows, columns, event.currentTarget)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          <label className="editor-table-header-option">
            <input
              type="checkbox"
              checked={withHeaderRow}
              onChange={(event) => setWithHeaderRow(event.target.checked)}
            />
            첫 행을 머리글로 사용
          </label>

          <form className="editor-table-direct-form" onSubmit={handleDirectTableSubmit}>
            <strong>직접 입력</strong>
            <label>
              열
              <input
                type="number"
                min={1}
                max={TABLE_DIRECT_INPUT_MAXIMUM}
                value={directColumns}
                onChange={(event) => setDirectColumns(Math.min(TABLE_DIRECT_INPUT_MAXIMUM, Math.max(1, Number(event.target.value) || 1)))}
              />
            </label>
            <span aria-hidden="true">×</span>
            <label>
              행
              <input
                type="number"
                min={1}
                max={TABLE_DIRECT_INPUT_MAXIMUM}
                value={directRows}
                onChange={(event) => setDirectRows(Math.min(TABLE_DIRECT_INPUT_MAXIMUM, Math.max(1, Number(event.target.value) || 1)))}
              />
            </label>
            <button type="submit">입력한 크기로 표 삽입</button>
          </form>
        </section>

        <section className="editor-table-edit-section" aria-labelledby="editor-table-edit-title">
          <strong id="editor-table-edit-title">선택한 표 편집</strong>
          {!isInsideTable ? <p>표 안에 커서를 놓으면 편집 기능이 활성화됩니다.</p> : null}
          <div className="editor-table-row-height-controls">
            <div className="editor-table-row-height-heading">
              <strong>행 높이</strong>
              <span>선택한 셀이 포함된 행 전체에 적용</span>
            </div>
            <div className="editor-table-row-height-inputs">
              <button
                type="button"
                aria-label="행 높이 줄이기"
                disabled={!isInsideTable || currentTableRowHeight <= TABLE_ROW_HEIGHT_MINIMUM}
                onClick={() => applyTableRowHeight(currentTableRowHeight - 4)}
              >
                −
              </button>
              <input
                type="range"
                min={TABLE_ROW_HEIGHT_MINIMUM}
                max={TABLE_ROW_HEIGHT_MAXIMUM}
                step={4}
                value={currentTableRowHeight}
                disabled={!isInsideTable}
                aria-label="선택한 행 높이 조절"
                onChange={(event) => applyTableRowHeight(Number(event.target.value))}
              />
              <label>
                <input
                  type="number"
                  min={TABLE_ROW_HEIGHT_MINIMUM}
                  max={TABLE_ROW_HEIGHT_MAXIMUM}
                  value={currentTableRowHeight}
                  disabled={!isInsideTable}
                  aria-label="선택한 행 높이 픽셀"
                  onChange={(event) => applyTableRowHeight(Number(event.target.value))}
                />
                px
              </label>
              <button
                type="button"
                aria-label="행 높이 늘리기"
                disabled={!isInsideTable || currentTableRowHeight >= TABLE_ROW_HEIGHT_MAXIMUM}
                onClick={() => applyTableRowHeight(currentTableRowHeight + 4)}
              >
                ＋
              </button>
              <button
                type="button"
                disabled={!isInsideTable || getSelectedTableRowHeight(editor) === null}
                onClick={() => editor.chain().focus().setTableRowHeight(null).run()}
              >
                높이 초기화
              </button>
            </div>
          </div>
          <div className="editor-table-background-controls">
            <div className="editor-table-background-heading">
              <strong>셀 배경색</strong>
              <span>{isInsideTable ? "현재 셀 또는 선택한 셀에 적용" : "표 셀을 먼저 선택하세요"}</span>
            </div>
            <div className="editor-table-color-palette" role="group" aria-label="셀 배경색 팔레트">
              {CELL_BACKGROUND_PALETTE.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  className={currentCellBackgroundColor === color ? "active" : undefined}
                  aria-label={`${label} 셀 배경색`}
                  aria-pressed={currentCellBackgroundColor === color}
                  title={label}
                  disabled={!isInsideTable}
                  style={{ backgroundColor: color }}
                  onClick={() => applyCellBackgroundColor(color)}
                />
              ))}
            </div>
            <div className="editor-table-custom-color">
              <label>
                사용자 지정
                <input
                  type="color"
                  value={customCellBackgroundColor}
                  disabled={!isInsideTable}
                  aria-label="사용자 지정 셀 배경색"
                  onChange={(event) => {
                    setCustomCellBackgroundColor(event.target.value);
                    applyCellBackgroundColor(event.target.value);
                  }}
                />
              </label>
              <button type="button" disabled={!isInsideTable || !currentCellBackgroundColor} onClick={() => applyCellBackgroundColor(null)}>셀 배경색 제거</button>
            </div>
          </div>
          <div className="editor-table-edit-actions">
            <button type="button" disabled={!isInsideTable} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().addColumnBefore().run())}>왼쪽 열 추가</button>
            <button type="button" disabled={!isInsideTable} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().addColumnAfter().run())}>오른쪽 열 추가</button>
            <button type="button" disabled={!isInsideTable} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().deleteColumn().run())}>현재 열 삭제</button>
            <button type="button" disabled={!isInsideTable} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().addRowBefore().run())}>위쪽 행 추가</button>
            <button type="button" disabled={!isInsideTable} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().addRowAfter().run())}>아래쪽 행 추가</button>
            <button type="button" disabled={!isInsideTable} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().deleteRow().run())}>현재 행 삭제</button>
            <button type="button" disabled={!isInsideTable} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().toggleHeaderRow().run())}>머리글 행 전환</button>
            <button type="button" disabled={!editor.can().chain().focus().mergeCells().run()} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().mergeCells().run())}>셀 병합</button>
            <button type="button" disabled={!editor.can().chain().focus().splitCell().run()} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().splitCell().run())}>셀 나누기</button>
            <button type="button" disabled={!isInsideTable} onClick={(event) => runTableEditCommand(event, () => editor.chain().focus().deleteTable().run())}>표 삭제</button>
          </div>
        </section>
      </div>
    </details>
  );
};
