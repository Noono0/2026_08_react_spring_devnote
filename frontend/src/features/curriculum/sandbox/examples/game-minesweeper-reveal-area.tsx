/**
 * 게임 규칙 직접 만들어 보기(중급) — 지뢰 찾기의 빈 칸 연쇄 열기(BFS)
 *
 * 해 볼 것
 *  1. 아래 revealArea 함수를 완성하세요. 지금은 누른 칸 하나만 엽니다.
 *     - 판을 복사한 뒤(불변성) 큐(queue)에 시작 칸을 넣습니다.
 *     - 큐에서 칸을 하나 꺼내 엽니다(이미 열렸거나 깃발이면 건너뜀).
 *     - 그 칸의 주변 지뢰 수가 0이면 이웃 8칸을 큐에 넣습니다. 숫자 칸이면 거기서 멈춥니다.
 *     - 큐가 빌 때까지 반복합니다. 이렇게 가까운 칸부터 넓혀 가는 방법이 BFS(너비 우선 탐색)입니다.
 *  2. 채점표가 모두 ✅가 되면 아래 판의 빈 곳을 눌러 넓게 열리는지 보세요.
 *  3. (도전) 오른쪽 클릭(onContextMenu)으로 깃발을 꽂아 보세요.
 */
import { useState } from "react";

interface Cell {
  mine: boolean;
  adjacent: number; // 주변 8칸의 지뢰 수
  open: boolean;
  flag: boolean;
}
type Board = Cell[][];

/** (row, col)의 이웃 칸 위치(판 밖은 뺀다) */
function neighbors(board: Board, row: number, col: number): [number, number][] {
  const result: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < board.length && c >= 0 && c < (board[0]?.length ?? 0)) result.push([r, c]);
    }
  }
  return result;
}

// ── TODO: 여기를 완성하세요 ─────────────────────────────────────
function revealArea(board: Board, startRow: number, startCol: number): Board {
  const next = board.map((row) => row.map((cell) => ({ ...cell })));
  const start = next[startRow]?.[startCol];
  if (start && !start.flag) start.open = true;
  void neighbors; // 완성하면 이 줄은 지워도 됩니다(neighbors를 아직 쓰지 않아 남겨 둔 줄)
  return next;
}
// ────────────────────────────────────────────────────────────────

/** "*"는 지뢰, "."은 빈 칸인 글자 지도로 판을 만든다 */
function boardFrom(lines: string[]): Board {
  const board: Board = lines.map((line) => [...line].map((character) => ({ mine: character === "*", adjacent: 0, open: false, flag: false })));
  return board.map((row, r) => row.map((cell, c) => ({ ...cell, adjacent: neighbors(board, r, c).filter(([nr, nc]) => board[nr]?.[nc]?.mine).length })));
}

/** 판을 글자로: 열린 빈 칸 " ", 숫자, 닫힌 칸 "#", 깃발 "F" */
const view = (board: Board): string => board.map((row) => row.map((cell) => (cell.flag ? "F" : !cell.open ? "#" : cell.adjacent === 0 ? " " : String(cell.adjacent))).join("")).join("/");

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

function runChecks(): Check[] {
  try {
    const board = boardFrom(["....", "....", "...*"]);
    const opened = revealArea(board, 0, 0);
    const numberOnly = revealArea(boardFrom(["*..", "...", "..."]), 1, 1);
    const withFlag = boardFrom(["...", "...", "..*"]).map((row, r) => row.map((cell, c) => (r === 0 && c === 2 ? { ...cell, flag: true } : cell)));
    return [
      { name: "빈 칸(0)에서 이웃으로 넓혀 열고, 숫자 칸에서 멈춘다", pass: view(opened) === "    /  11/  1#", detail: view(opened) },
      { name: "숫자 칸을 누르면 그 칸만 열린다", pass: view(numberOnly) === "###/#1#/###", detail: view(numberOnly) },
      { name: "깃발 칸은 열지 않는다", pass: view(revealArea(withFlag, 0, 0)).startsWith("  F"), detail: view(revealArea(withFlag, 0, 0)) },
      { name: "원본 판을 바꾸지 않는다", pass: board.every((row) => row.every((cell) => !cell.open)) },
    ];
  } catch (error) {
    return [{ name: "revealArea 실행 중 오류", pass: false, detail: String(error) }];
  }
}

const DEMO = [
  "..........",
  "..*.......",
  "..........",
  "......*...",
  "..........",
  "*.........",
  "........*.",
  "...*......",
];

export default function App() {
  const checks = runChecks();
  const [board, setBoard] = useState(() => boardFrom(DEMO));
  const lost = board.some((row) => row.some((cell) => cell.mine && cell.open));

  const open = (row: number, col: number) => {
    if (lost) return;
    setBoard((previous) => revealArea(previous, row, col));
  };

  return (
    <main>
      <h1>revealArea 채점표</h1>
      <ul>
        {checks.map((check) => (
          <li key={check.name}>
            {check.pass ? "✅" : "❌"} {check.name}
            {check.detail ? <small> — "{check.detail}"</small> : null}
          </li>
        ))}
      </ul>

      <h2>작은 지뢰판 {lost ? "💥 지뢰를 밟았습니다" : ""}</h2>
      <p>왼쪽 위 빈 곳을 눌러 보세요. 지뢰는 8개입니다.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 30px)", gap: 2 }}>
        {board.map((row, r) => row.map((cell, c) => (
          <button key={`${r}-${c}`} onClick={() => open(r, c)} style={{ width: 30, height: 30, padding: 0, fontWeight: 700, background: cell.open ? "rgba(127,127,127,.15)" : "rgba(127,127,127,.45)" }}>
            {cell.open ? (cell.mine ? "💣" : cell.adjacent || "") : ""}
          </button>
        )))}
      </div>
      <button style={{ marginTop: 12 }} onClick={() => setBoard(boardFrom(DEMO))}>다시 하기</button>
    </main>
  );
}
