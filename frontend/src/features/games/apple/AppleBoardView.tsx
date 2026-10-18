/**
 * AppleBoardView.tsx — 사과게임 판(혼자 연습·온라인 대전 공용)
 *
 * [고르는 방법 두 가지]
 *   1) 마우스·손가락으로 끌기: 누른 칸부터 손을 뗀 칸까지의 사각형을 고른다(Pointer Events + setPointerCapture).
 *   2) 키보드·한 번씩 누르기: 칸(버튼)을 한 번 누르면 시작 칸, 다른 칸을 누르면 그 사각형을 고른다.
 * 고르는 동안 사각형 안 사과 숫자의 합을 보여 주고, 합이 10이면 초록색으로 표시한다.
 * 실제로 없앨지(합이 10인지) 판단과 점수 계산은 부모가 한다(혼자 연습 = appleLogic, 온라인 = 서버).
 *
 * [끌기 중인 칸 찾기] 손가락이 움직일 때 어느 칸 위인지는 판 전체 크기를 칸 수로 나눠 계산한다.
 *   칸마다 pointerenter를 다는 방식은 터치에서 이벤트가 오지 않을 수 있어서다(포인터를 판이 잡고 있기 때문).
 */
import { useState, type PointerEvent } from "react";
import {
  APPLE_COLUMNS, APPLE_ROWS, APPLE_TARGET_SUM, isInRect, summarizeRect, toRect, type AppleBoard, type CellPoint, type CellRect,
} from "@/features/games/apple/appleLogic";

interface AppleBoardViewProps {
  board: AppleBoard;
  disabled: boolean;
  onSelect: (rect: CellRect) => void;
}

export const AppleBoardView = ({ board, disabled, onSelect }: AppleBoardViewProps) => {
  const [anchor, setAnchor] = useState<CellPoint | null>(null);
  const [current, setCurrent] = useState<CellPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const rect = anchor && current ? toRect(anchor, current) : null;
  const { sum } = rect ? summarizeRect(board, rect) : { sum: 0 };

  const cellAt = (event: PointerEvent<HTMLDivElement>): CellPoint | null => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;
    const col = Math.floor(((event.clientX - box.left) / box.width) * APPLE_COLUMNS);
    const row = Math.floor(((event.clientY - box.top) / box.height) * APPLE_ROWS);
    if (col < 0 || col >= APPLE_COLUMNS || row < 0 || row >= APPLE_ROWS) return null;
    return { row, col };
  };

  const finish = (end: CellPoint) => {
    if (anchor) onSelect(toRect(anchor, end));
    setAnchor(null);
    setCurrent(null);
    setDragging(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.pointerType === "mouse" && event.button !== 0) return;
    const cell = cellAt(event);
    if (!cell) return;
    // 앞에서 한 번 눌러 시작 칸이 있으면, 이번 누름은 "끝 칸"이다(같은 칸이면 취소)
    if (anchor && !dragging) {
      if (cell.row === anchor.row && cell.col === anchor.col) {
        setAnchor(null);
        setCurrent(null);
      } else {
        finish(cell);
      }
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setAnchor(cell);
    setCurrent(cell);
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const cell = cellAt(event);
    if (cell && (cell.row !== current?.row || cell.col !== current.col)) setCurrent(cell);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const cell = cellAt(event) ?? current;
    // 같은 칸에서 누르고 뗀 것은 "한 번 누르기"로 보고 시작 칸만 남긴다(다음 칸을 누르면 사각형 완성)
    if (cell && anchor && cell.row === anchor.row && cell.col === anchor.col) {
      setDragging(false);
      return;
    }
    if (cell) finish(cell);
  };

  /** 키보드(Enter·Space)나 끌지 않은 클릭: 시작 칸 → 끝 칸 */
  const handleCellActivate = (cell: CellPoint) => {
    if (disabled || dragging) return;
    if (!anchor) {
      setAnchor(cell);
      setCurrent(cell);
      return;
    }
    finish(cell);
  };

  return (
    <div className="apple-board-wrap">
      <p className={`apple-sum${rect ? (sum === APPLE_TARGET_SUM ? " ok" : sum > APPLE_TARGET_SUM ? " over" : "") : ""}`} aria-live="polite">
        {rect ? `고른 사과 합: ${sum}${sum === APPLE_TARGET_SUM ? " ✔" : ""}` : "사각형으로 사과를 골라 합 10을 만드세요."}
      </p>
      <div className={`apple-board${disabled ? " disabled" : ""}`} role="grid" aria-label="사과 판"
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        onPointerCancel={() => { setDragging(false); setAnchor(null); setCurrent(null); }}>
        {board.map((cells, row) => (
          <div key={row} role="row" className="apple-row">
            {cells.map((value, col) => {
              const selected = rect !== null && isInRect(rect, row, col);
              const isAnchor = anchor?.row === row && anchor.col === col;
              return (
                <button key={col} type="button" role="gridcell" disabled={disabled}
                  className={`apple-cell${value === 0 ? " empty" : ""}${selected ? " selected" : ""}${isAnchor ? " anchor" : ""}`}
                  aria-label={`${row + 1}줄 ${col + 1}칸 ${value === 0 ? "빈칸" : `사과 ${value}`}${isAnchor ? " (시작 칸)" : ""}`}
                  // 포인터 끌기는 판(div)이 처리한다. 버튼 클릭은 키보드(Enter·Space)일 때만 쓴다(detail 0)
                  onClick={(event) => { if (event.detail === 0) handleCellActivate({ row, col }); }}>
                  {value === 0 ? null : <span aria-hidden="true">{value}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
