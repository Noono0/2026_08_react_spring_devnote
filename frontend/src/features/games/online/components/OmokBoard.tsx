/**
 * OmokBoard.tsx — 15×15 오목 판
 *
 * 판의 내용은 서버가 보낸 상태(omok)를 그대로 그린다. 누르면 "여기 둘게요"(onPlace)만 알리고,
 * 실제로 돌이 놓이는 것은 서버가 확인한 새 상태가 왔을 때다.
 *
 * 키보드: 판 안에서 방향키로 칸을 옮기고 Enter·Space로 둔다(로빙 탭인덱스 — 지뢰 찾기와 같은 방법).
 */
import { useRef, useState, type KeyboardEvent } from "react";
import type { OmokState } from "@/features/games/online/onlineTypes";

export const OMOK_SIZE = 15;
const STONE_LABELS = ["빈칸", "흑", "백"] as const;
const arrowOffsets: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

interface OmokBoardProperties {
  omok: OmokState | null | undefined;
  /** 지금 내가 둘 수 있는지(게임 중 + 내 차례) */
  canPlace: boolean;
  onPlace: (row: number, col: number) => void;
}

const emptyBoard = (): number[][] => Array.from({ length: OMOK_SIZE }, () => Array.from({ length: OMOK_SIZE }, () => 0));

export const OmokBoard = ({ omok, canPlace, onPlace }: OmokBoardProperties) => {
  const board = omok?.board ?? emptyBoard();
  const [focused, setFocused] = useState({ row: 7, col: 7 });
  const cellsRef = useRef(new Map<string, HTMLButtonElement>());
  const winKeys = new Set((omok?.winLine ?? []).map((position) => `${position.row}-${position.col}`));

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const offset = arrowOffsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const next = {
      row: Math.min(OMOK_SIZE - 1, Math.max(0, focused.row + offset[0])),
      col: Math.min(OMOK_SIZE - 1, Math.max(0, focused.col + offset[1])),
    };
    setFocused(next);
    cellsRef.current.get(`${next.row}-${next.col}`)?.focus();
  };

  return (
    <div className={`omok-board${canPlace ? " can-place" : ""}`} role="group" aria-label="오목 판 15×15. 방향키로 이동, Enter로 두기" onKeyDown={handleKeyDown}>
      {board.map((row, rowIndex) => row.map((stone, colIndex) => {
        const key = `${rowIndex}-${colIndex}`;
        const isLast = omok?.lastMove?.row === rowIndex && omok.lastMove.col === colIndex;
        const className = ["omok-cell", stone === 1 ? "black" : stone === 2 ? "white" : "", isLast ? "last" : "", winKeys.has(key) ? "win" : ""].filter(Boolean).join(" ");
        return (
          <button
            key={key}
            ref={(element) => {
              if (element) cellsRef.current.set(key, element);
              else cellsRef.current.delete(key);
            }}
            type="button"
            className={className}
            tabIndex={focused.row === rowIndex && focused.col === colIndex ? 0 : -1}
            aria-label={`${rowIndex + 1}행 ${colIndex + 1}열 ${STONE_LABELS[stone] ?? "빈칸"}${isLast ? " (마지막 수)" : ""}`}
            // 둘 수 없는 칸도 포커스는 받아야 하므로 disabled 대신 aria-disabled를 쓴다
            aria-disabled={!canPlace || stone !== 0}
            onClick={() => {
              setFocused({ row: rowIndex, col: colIndex });
              if (canPlace && stone === 0) onPlace(rowIndex, colIndex);
            }}
          >
            <span className="omok-stone" aria-hidden="true" />
          </button>
        );
      }))}
    </div>
  );
};
