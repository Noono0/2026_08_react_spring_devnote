import { useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Editor } from "@tiptap/core";
import {
  clampTableRowHeight,
  getSelectedTableRowHeight,
  TABLE_ROW_HEIGHT_DEFAULT,
  TABLE_ROW_HEIGHT_MAXIMUM,
  TABLE_ROW_HEIGHT_MINIMUM,
} from "@/features/rich-text-editor/extensions/tableRowHeight";

// 격자 선택은 10×10까지, 숫자 직접 입력은 50×50까지 허용한다.
const TABLE_PICKER_GRID_SIZE = 10;
const TABLE_DIRECT_INPUT_MAXIMUM = 50;
// 셀 배경색 빠른 선택 팔레트(tableCellBackground.ts가 허용하는 #rrggbb 형식).
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
  // 커서가 있는 칸(머리글 칸이면 th, 아니면 td)의 현재 배경색과 행 높이를 읽어 입력칸에 보여 준다.
  const currentCellBackgroundColor = String(
    editor.getAttributes(editor.isActive("tableHeader") ? "tableHeader" : "tableCell").backgroundColor ?? "",
  );
  const currentTableRowHeight = getSelectedTableRowHeight(editor) ?? TABLE_ROW_HEIGHT_DEFAULT;

  /** 표를 넣고 메뉴를 닫는다. withHeaderRow: 첫 줄을 머리글(th)로 만들지 여부. */
  const insertTable = (rows: number, columns: number, sourceElement: HTMLElement): void => {
    editor.chain().focus().insertTable({ rows, cols: columns, withHeaderRow }).run();
    closeTableMenu(sourceElement);
  };

  /** 격자에서 (행, 열) 칸 버튼으로 포커스를 옮긴다(data-table-row·data-table-column 속성으로 찾는다). */
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

  /**
   * 키보드로 격자 고르기: 화살표로 한 칸씩, Home은 1×1, End는 10×10.
   * 처리하는 키일 때만 preventDefault로 페이지 스크롤을 막고, 나머지 키(Tab 등)는 원래대로 둔다.
   */
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

  /**
   * 직접 입력한 크기로 표를 넣는다.
   *
   * ★ 왜 <form onSubmit>을 쓰지 않을까?
   *   이 에디터는 문서 작성 화면의 <form> 안에 들어간다. HTML은 form 안에 form을 허용하지 않고,
   *   React의 submit 이벤트는 컴포넌트 트리를 따라 바깥 form까지 올라간다.
   *   그래서 예전처럼 안쪽 form을 쓰면 표 크기 입력칸에서 Enter를 눌렀을 때
   *   바깥 문서의 "저장"까지 함께 실행될 수 있었다.
   *   ✓ 그래서 일반 버튼(type="button") + 입력칸의 Enter 처리로 바꿨다.
   */
  const insertDirectTable = (triggerElement: HTMLElement): void => {
    insertTable(directRows, directColumns, triggerElement);
  };

  /** 입력칸에서 Enter를 누르면 표를 넣는다. preventDefault로 바깥 form 제출을 막는다. */
  const handleDirectInputKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>): void => {
    if (keyboardEvent.key !== "Enter") return;
    keyboardEvent.preventDefault();
    insertDirectTable(keyboardEvent.currentTarget);
  };

  /** 행·열 추가·삭제 같은 표 편집 명령을 실행하고 메뉴를 닫는다. */
  const runTableEditCommand = (
    mouseEvent: MouseEvent<HTMLButtonElement>,
    command: () => boolean,
  ): void => {
    command();
    closeTableMenu(mouseEvent.currentTarget);
  };

  /** 선택한 칸들의 배경색을 바꾼다(null이면 지우기). 표 밖에서는 아무것도 하지 않는다. */
  const applyCellBackgroundColor = (backgroundColor: string | null): void => {
    if (!isInsideTable) return;
    editor.chain().focus().setCellAttribute("backgroundColor", backgroundColor).run();
  };

  /** 선택한 행의 높이를 32~500px 안으로 맞춰 적용한다(tableRowHeight.ts). */
  const applyTableRowHeight = (rowHeight: number): void => {
    if (!isInsideTable) return;
    editor.chain().focus().setTableRowHeight(clampTableRowHeight(rowHeight)).run();
  };

  return (
    // <details>/<summary>: 브라우저 기본 펼침 메뉴. 열고 닫기를 State 없이 HTML이 처리하고 키보드(Enter·Space)로도 열린다.
    <details className="editor-toolbar-menu">
      <summary
        className={`editor-tool-button ${isInsideTable ? "active" : ""}`}
        aria-label="표 도구"
        title="표 도구"
      >
        ▦
      </summary>

      <div className="editor-toolbar-menu-panel editor-table-menu-panel">
        {/* 위: 표 삽입(격자·직접 입력) / 아래: 커서가 표 안에 있을 때 쓰는 편집 도구(행 높이·배경색·행열 추가 삭제) */}
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

          {/* form 대신 role="group"으로 "관련 입력칸 묶음"임을 화면 낭독기에 알린다(위 insertDirectTable 설명 참고). */}
          <div className="editor-table-direct-form" role="group" aria-labelledby="editor-table-direct-title">
            <strong id="editor-table-direct-title">직접 입력</strong>
            <label>
              열
              <input
                type="number"
                min={1}
                max={TABLE_DIRECT_INPUT_MAXIMUM}
                value={directColumns}
                onChange={(event) => setDirectColumns(Math.min(TABLE_DIRECT_INPUT_MAXIMUM, Math.max(1, Number(event.target.value) || 1)))}
                onKeyDown={handleDirectInputKeyDown}
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
                onKeyDown={handleDirectInputKeyDown}
              />
            </label>
            <button type="button" onClick={(event) => insertDirectTable(event.currentTarget)}>입력한 크기로 표 삽입</button>
          </div>
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
