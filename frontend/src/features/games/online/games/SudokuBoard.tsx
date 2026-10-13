/**
 * SudokuBoard.tsx — 스도쿠 판과 숫자 버튼(스도쿠 대전 화면이 쓴다)
 *
 * 판은 "보여 주기"와 "무엇을 눌렀는지 알리기"만 한다. 숫자를 넣을지는 부모(SudokuGame)가 정해 서버에 보낸다.
 * 그래서 고른 칸(selected)도 부모 State다. 숫자 버튼을 누를 때 부모가 "어느 칸인지" 알아야 하기 때문이다.
 *
 * [조작] 칸을 누르거나 방향키로 고르고, 숫자 버튼·키보드 1~9로 넣는다. 지우기는 버튼·Backspace·Delete·0.
 * [로빙 탭인덱스] 지뢰 찾기와 같다. 고른 칸 하나만 tabIndex=0이고, 방향키로 고른 칸과 포커스를 함께 옮긴다.
 * [강조] 고른 칸의 가로줄·세로줄·상자는 옅게, 같은 숫자는 진하게, 겹치는 숫자는 빨갛게 보여 준다.
 * [정답 공개] solution을 주면(게임이 끝난 뒤) 틀린 숫자는 빨간 줄로, 못 채운 칸은 정답을 흐리게 보여 준다.
 */
import { useRef, type KeyboardEvent } from "react";
import { findConflicts, isPeer, SUDOKU_DIGITS, SUDOKU_SIZE, valueAt, type Position, type SudokuGrid } from "@/features/games/sudoku/sudokuLogic";

interface SudokuBoardProps {
  /** 고정 숫자(0 = 빈 칸) */
  givens: SudokuGrid;
  /** 지금 판(고정 숫자 포함) */
  values: SudokuGrid;
  /** 공개된 정답. 있으면 틀린 칸·못 채운 칸을 정답과 비교해 보여 준다 */
  solution: SudokuGrid | null;
  selected: Position;
  /** true면 칸을 고를 수만 있고 숫자 입력은 알리지 않는다(끝난 판·관전자·기권) */
  readOnly: boolean;
  label: string;
  onSelect: (position: Position) => void;
  onDigit: (value: number) => void;
  onErase: () => void;
}

const arrowOffsets: Record<string, Position> = {
  ArrowUp: { row: -1, col: 0 }, ArrowDown: { row: 1, col: 0 }, ArrowLeft: { row: 0, col: -1 }, ArrowRight: { row: 0, col: 1 },
};
const eraseKeys = new Set(["Backspace", "Delete", "0"]);

interface CellView {
  row: number;
  col: number;
  value: number;
  given: boolean;
  conflict: boolean;
  /** 공개된 정답(없으면 0) */
  answer: number;
}

/** 화면 낭독기용 칸 설명 */
const describeCell = ({ row, col, value, given, conflict, answer }: CellView): string => {
  const position = `${row + 1}행 ${col + 1}열`;
  if (given) return `${position}, 고정 숫자 ${value}`;
  if (value !== 0 && answer !== 0 && value !== answer) return `${position}, ${value} (틀림, 정답 ${answer})`;
  if (value !== 0) return `${position}, ${value}${conflict ? " (겹침)" : ""}`;
  return answer !== 0 ? `${position}, 빈 칸 (정답 ${answer})` : `${position}, 빈 칸`;
};

export const SudokuBoard = ({ givens, values, solution, selected, readOnly, label, onSelect, onDigit, onErase }: SudokuBoardProps) => {
  // 칸 버튼들. "행-열" → 버튼. 포커스를 옮길 DOM이라 State가 아니라 ref에 둔다(지뢰 찾기와 같다)
  const cellButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  const conflicts = findConflicts(values);
  const selectedValue = valueAt(values, selected.row, selected.col);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const offset = arrowOffsets[event.key];
    if (offset) {
      event.preventDefault();
      const next = {
        row: Math.min(SUDOKU_SIZE - 1, Math.max(0, selected.row + offset.row)),
        col: Math.min(SUDOKU_SIZE - 1, Math.max(0, selected.col + offset.col)),
      };
      onSelect(next);
      cellButtonsRef.current.get(`${next.row}-${next.col}`)?.focus();
      return;
    }
    if (readOnly) return;
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      onDigit(Number(event.key));
    } else if (eraseKeys.has(event.key)) {
      event.preventDefault();
      onErase();
    }
  };

  return (
    <div className={`sudoku-board${readOnly ? " read-only" : ""}`} role="group" aria-label={label} onKeyDown={handleKeyDown}>
      {values.map((line, row) => line.map((value, col) => {
        const key = `${row}-${col}`;
        const cell: CellView = {
          row, col, value,
          given: valueAt(givens, row, col) !== 0,
          conflict: conflicts[row]?.[col] === true,
          answer: solution ? valueAt(solution, row, col) : 0,
        };
        const isSelected = selected.row === row && selected.col === col;
        const className = [
          "sudoku-cell",
          cell.given ? "given" : "",
          isSelected ? "selected" : isPeer(selected, { row, col }) ? "peer" : "",
          !isSelected && selectedValue !== 0 && value === selectedValue ? "same-digit" : "",
          cell.conflict ? "conflict" : "",
          value !== 0 && cell.answer !== 0 && value !== cell.answer ? "wrong" : "",
          value === 0 && cell.answer !== 0 ? "revealed" : "",
          col % 3 === 2 && col < SUDOKU_SIZE - 1 ? "box-right" : "",
          row % 3 === 2 && row < SUDOKU_SIZE - 1 ? "box-bottom" : "",
        ].filter(Boolean).join(" ");
        return (
          <button
            key={key}
            ref={(element) => {
              if (element) cellButtonsRef.current.set(key, element);
              else cellButtonsRef.current.delete(key);
            }}
            type="button"
            className={className}
            tabIndex={isSelected ? 0 : -1}
            aria-label={describeCell(cell)}
            onClick={() => onSelect({ row, col })}
          >
            {/* 고정 숫자는 그냥 숫자, 내가 넣은 숫자는 동그라미 안에 넣어 한눈에 구분한다 */}
            {value === 0 ? (cell.answer !== 0 ? cell.answer : "") : cell.given ? value : <span className="sudoku-entry">{value}</span>}
          </button>
        );
      }))}
    </div>
  );
};

/** 숫자 버튼 1~9 + 지우기. 터치 화면에는 키보드가 없으므로 꼭 필요하다 */
export const SudokuNumberPad = ({ disabled, onDigit, onErase }: { disabled: boolean; onDigit: (value: number) => void; onErase: () => void }) => (
  <div className="sudoku-number-pad" role="group" aria-label="숫자 넣기">
    {SUDOKU_DIGITS.map((digit) => (
      <button key={digit} type="button" disabled={disabled} aria-label={`숫자 ${digit}`} onClick={() => onDigit(digit)}>{digit}</button>
    ))}
    <button type="button" className="ghost-button sudoku-erase-button" disabled={disabled} onClick={onErase}>지우기</button>
  </div>
);
