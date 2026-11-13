import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Maze, Point, Direction } from "./mazeLogic";
import "./maze.css";
const directions: { value: Direction; label: string; symbol: string }[] = [
  { value: "UP", label: "위로 이동", symbol: "↑" }, { value: "LEFT", label: "왼쪽으로 이동", symbol: "←" },
  { value: "DOWN", label: "아래로 이동", symbol: "↓" }, { value: "RIGHT", label: "오른쪽으로 이동", symbol: "→" },
];
const keyboardDirections: Record<string, Direction> = { ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT", w: "UP", a: "LEFT", s: "DOWN", d: "RIGHT" };

export function MazeBoardView({ maze, position, disabled, onMove: move, hint = [] }: { maze: Maze; position: Point; disabled: boolean; onMove: (direction: Direction) => void; hint?: Point[] }) {
  const boardReference = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!disabled) boardReference.current?.focus(); }, [disabled]);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const direction = keyboardDirections[event.key] ?? keyboardDirections[event.key.toLowerCase()];
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); if (!disabled) move(direction);
  };
  return <>
    <div className="maze-keyboard" ref={boardReference} tabIndex={0} role="region" aria-label="미로 키보드 조작 영역" onKeyDown={onKeyDown}>
      <svg className="maze-board" viewBox={`0 0 ${maze.size} ${maze.size}`} role="img" aria-label={`미로: 현재 ${position.row}행 ${position.col}열, 출구 ${maze.exit.row}행 ${maze.exit.col}열`}>
        <rect width={maze.size} height={maze.size} className="maze-floor" />
        {maze.walls.flatMap((row, rowIndex) => row.map((wall, colIndex) => wall ? <rect key={`${rowIndex}:${colIndex}`} x={colIndex} y={rowIndex} width={1} height={1} className="maze-wall" /> : null))}
        {hint.length > 0 ? <polyline className="maze-hint-path" points={hint.map((point) => `${point.col + 0.5},${point.row + 0.5}`).join(" ")} /> : null}
        <rect x={maze.exit.col + 0.12} y={maze.exit.row + 0.12} width={0.76} height={0.76} rx={0.15} className="maze-exit" />
        <text x={maze.exit.col + 0.5} y={maze.exit.row + 0.69} className="maze-exit-text" textAnchor="middle">출</text>
        <circle cx={position.col + 0.5} cy={position.row + 0.5} r={0.34} className="maze-player" />
      </svg>
    </div>
    <div className="maze-controls" aria-label="미로 이동 버튼">{directions.map((direction) => <button type="button" key={direction.value} data-direction={direction.value}
      aria-label={direction.label} disabled={disabled} onKeyDown={onKeyDown} onClick={() => move(direction.value)}>{direction.symbol}</button>)}</div>
  </>;
}
