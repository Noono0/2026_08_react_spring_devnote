/**
 * 게임 규칙 직접 만들어 보기(중급) — 테트리스의 꽉 찬 줄 지우기(clearLines)
 *
 * 해 볼 것
 *  1. 아래 clearLines 함수를 완성하세요. 지금은 아무 줄도 지우지 않습니다.
 *     - 칸이 하나라도 비어 있는(null) 줄만 남깁니다. (filter)
 *     - 지운 줄 수 = 원래 줄 수 - 남은 줄 수
 *     - 판 높이가 줄면 안 되므로, 지운 만큼 빈 줄을 "맨 위"에 채웁니다. 블록이 아래로 떨어진 것처럼 보입니다.
 *     - 원본 판은 바꾸지 말고 새 판을 돌려줍니다.
 *  2. 채점표가 모두 ✅가 되면 아래 판에서 칸을 눌러 채운 뒤 "줄 지우기"를 눌러 보세요.
 *  3. (도전) 지운 줄 수로 점수를 매겨 보세요. 1줄 100, 2줄 300, 3줄 500, 4줄 800
 */
import { useState } from "react";

type Cell = string | null; // 블록 색 이름 또는 빈칸(null)
type Board = Cell[][];

// ── TODO: 여기를 완성하세요 ─────────────────────────────────────
function clearLines(board: Board): { board: Board; cleared: number } {
  return { board: board.map((row) => [...row]), cleared: 0 };
}
// ────────────────────────────────────────────────────────────────

const COLS = 6;
const emptyRow = (): Cell[] => Array.from({ length: COLS }, () => null);
/** "X"는 채운 칸, "."은 빈칸인 글자 지도 → 판 */
const boardFrom = (lines: string[]): Board => lines.map((line) => [...line].map((character) => (character === "X" ? "teal" : null)));
const view = (board: Board): string => board.map((row) => row.map((cell) => (cell ? "X" : ".")).join("")).join("/");

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

function runChecks(): Check[] {
  try {
    const board = boardFrom(["......", "X.....", "XXXXXX", "XX.XXX", "XXXXXX"]);
    const result = clearLines(board);
    const nothing = clearLines(boardFrom(["......", "X.X.X."]));
    return [
      { name: "꽉 찬 줄 수를 센다", pass: result.cleared === 2, detail: `cleared = ${result.cleared}` },
      { name: "남은 줄이 아래로 내려오고 위가 빈 줄로 채워진다", pass: view(result.board) === "....../....../....../X...../XX.XXX", detail: view(result.board) },
      { name: "판 높이가 그대로다", pass: result.board.length === board.length },
      { name: "꽉 찬 줄이 없으면 그대로", pass: nothing.cleared === 0 && view(nothing.board) === "....../X.X.X." },
      { name: "원본 판을 바꾸지 않는다", pass: view(board) === "....../X...../XXXXXX/XX.XXX/XXXXXX" },
    ];
  } catch (error) {
    return [{ name: "clearLines 실행 중 오류", pass: false, detail: String(error) }];
  }
}

const startBoard = (): Board => [emptyRow(), emptyRow(), ...boardFrom(["XX..XX", "XXXXX.", "XXX.XX", "X.XXXX"])];

export default function App() {
  const checks = runChecks();
  const [board, setBoard] = useState(startBoard);
  const [lastCleared, setLastCleared] = useState<number | null>(null);

  // 칸 하나 채우기·비우기(불변성: map으로 새 판)
  const toggleCell = (targetRow: number, targetCol: number) =>
    setBoard((previous) => previous.map((row, r) => row.map((cell, c) => (r === targetRow && c === targetCol ? (cell ? null : "orange") : cell))));

  const clear = () => {
    const result = clearLines(board);
    setBoard(result.board);
    setLastCleared(result.cleared);
  };

  return (
    <main>
      <h1>clearLines 채점표</h1>
      <ul>
        {checks.map((check) => (
          <li key={check.name}>
            {check.pass ? "✅" : "❌"} {check.name}
            {check.detail ? <small> — "{check.detail}"</small> : null}
          </li>
        ))}
      </ul>

      <h2>줄 지우기 연습판</h2>
      <p>빈칸을 눌러 줄을 채운 뒤 "줄 지우기"를 누르세요.</p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 32px)`, gap: 2 }}>
        {board.map((row, r) => row.map((cell, c) => (
          <button key={`${r}-${c}`} aria-label={`${r + 1}행 ${c + 1}열`} onClick={() => toggleCell(r, c)} style={{ width: 32, height: 32, padding: 0, background: cell ?? "rgba(127,127,127,.2)", border: "1px solid rgba(127,127,127,.4)" }} />
        )))}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={clear}>줄 지우기</button>
        <button onClick={() => { setBoard(startBoard()); setLastCleared(null); }}>처음 판</button>
        {lastCleared !== null ? <span>{lastCleared}줄 지웠습니다</span> : null}
      </div>
    </main>
  );
}
