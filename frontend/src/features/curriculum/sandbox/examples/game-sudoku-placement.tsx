/**
 * 게임 규칙 직접 만들어 보기(초급) — 스도쿠의 숫자를 놓아도 되는지 검사하기(isValidPlacement)
 *
 * 해 볼 것
 *  1. 아래 isValidPlacement 함수를 완성하세요. 지금은 같은 가로줄만 검사합니다.
 *     - 같은 세로줄(col)의 다른 칸에 value가 있으면 false
 *     - 같은 3×3 상자의 다른 칸에 value가 있으면 false
 *       상자의 왼쪽 위 칸 = (Math.floor(row / 3) * 3, Math.floor(col / 3) * 3). 거기서부터 3칸 × 3칸을 봅니다.
 *     - 검사하는 칸 "자기 자신"은 빼고 봅니다(그 칸에 이미 value가 들어 있어도 겹침이 아닙니다).
 *     - 판(grid)은 읽기만 하고 바꾸지 않습니다.
 *  2. 채점표가 모두 ✅가 되면 아래 판에서 빈 칸을 고르고 숫자를 넣어 보세요. 규칙에 어긋나는 숫자는 빨갛게 보입니다.
 *  3. (도전) 고른 칸에 넣을 수 있는 숫자만 숫자 버튼에 밝게 보여 주세요. 1~9 중 isValidPlacement가 true인 것만 고르면 됩니다.
 */
import { useState } from "react";

type Grid = number[][]; // 9×9 판. 0은 빈 칸

// ── TODO: 여기를 완성하세요 ─────────────────────────────────────
function isValidPlacement(grid: Grid, row: number, col: number, value: number): boolean {
  // 같은 가로줄: 자기 자신(col)은 빼고 같은 숫자가 있는지 본다
  for (let otherCol = 0; otherCol < 9; otherCol += 1) {
    if (otherCol !== col && grid[row]?.[otherCol] === value) return false;
  }
  return true;
}
// ────────────────────────────────────────────────────────────────

/** 처음 문제(0 = 빈 칸). 위키백과 "스도쿠" 문서에 실린 문제다 */
const PUZZLE: Grid = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

// 칸마다 "어느 규칙 하나에만" 걸리도록 골랐다. 그래서 어떤 검사를 빠뜨렸는지 채점표에서 바로 보인다
const cases: { name: string; row: number; col: number; value: number; expected: boolean }[] = [
  { name: "같은 가로줄에 있으면 놓을 수 없다", row: 0, col: 6, value: 7, expected: false },
  { name: "같은 세로줄에 있으면 놓을 수 없다", row: 2, col: 0, value: 4, expected: false },
  { name: "같은 3×3 상자에 있으면 놓을 수 없다", row: 1, col: 1, value: 8, expected: false },
  { name: "겹치는 곳이 없으면 놓을 수 있다", row: 0, col: 2, value: 4, expected: true },
  { name: "자기 칸에 이미 있는 숫자는 겹침으로 치지 않는다", row: 0, col: 0, value: 5, expected: true },
];

function runChecks(): Check[] {
  try {
    const snapshot = JSON.stringify(PUZZLE);
    const results = cases.map((testCase): Check => {
      const result = isValidPlacement(PUZZLE, testCase.row, testCase.col, testCase.value);
      return { name: testCase.name, pass: result === testCase.expected, detail: `${testCase.row + 1}행 ${testCase.col + 1}열에 ${testCase.value} → ${String(result)}` };
    });
    return [...results, { name: "판을 바꾸지 않는다", pass: JSON.stringify(PUZZLE) === snapshot }];
  } catch (error) {
    return [{ name: "isValidPlacement 실행 중 오류", pass: false, detail: String(error) }];
  }
}

const isGiven = (row: number, col: number): boolean => (PUZZLE[row]?.[col] ?? 0) !== 0;
const copyPuzzle = (): Grid => PUZZLE.map((line) => [...line]);

export default function App() {
  const checks = runChecks();
  const [values, setValues] = useState<Grid>(copyPuzzle);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  // 고른 칸에 숫자를 넣는다(0 = 지우기). 불변성: map으로 새 판을 만든다. 처음부터 놓인 숫자는 바꾸지 않는다
  const place = (value: number) => {
    const target = selected;
    if (!target || isGiven(target.row, target.col)) return;
    setValues((previous) => previous.map((line, r) => line.map((current, c) => (r === target.row && c === target.col ? value : current))));
  };

  // 겹침·완성은 State로 따로 두지 않고 그릴 때마다 판에서 계산한다
  const isConflict = (row: number, col: number): boolean => {
    const value = values[row]?.[col] ?? 0;
    return value !== 0 && !isValidPlacement(values, row, col, value);
  };
  const solved = values.every((line, r) => line.every((value, c) => value !== 0 && !isConflict(r, c)));

  return (
    <main>
      <h1>isValidPlacement 채점표</h1>
      <ul>
        {checks.map((check) => (
          <li key={check.name}>
            {check.pass ? "✅" : "❌"} {check.name}
            {check.detail ? <small> — {check.detail}</small> : null}
          </li>
        ))}
      </ul>

      <h2>스도쿠 연습판 {solved ? "🎉 완성!" : ""}</h2>
      <p>빈 칸을 누른 뒤 아래 숫자를 누르세요. 규칙에 어긋나는 숫자는 빨갛게 보입니다.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 34px)", width: "max-content", border: "2px solid currentColor" }}>
        {values.map((line, r) => line.map((value, c) => {
          const isSelected = selected?.row === r && selected.col === c;
          return (
            <button
              key={`${r}-${c}`}
              aria-label={`${r + 1}행 ${c + 1}열${value ? `, ${value}` : ", 빈 칸"}`}
              onClick={() => setSelected({ row: r, col: c })}
              style={{
                width: 34, height: 34, padding: 0, borderRadius: 0,
                fontWeight: isGiven(r, c) ? 900 : 500,
                color: isConflict(r, c) ? "crimson" : "inherit",
                background: isSelected ? "rgba(80, 140, 255, .35)" : "transparent",
                border: "1px solid rgba(127, 127, 127, .35)",
                borderRight: c % 3 === 2 && c < 8 ? "2px solid currentColor" : undefined,
                borderBottom: r % 3 === 2 && r < 8 ? "2px solid currentColor" : undefined,
              }}
            >
              {value || ""}
            </button>
          );
        }))}
      </div>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {DIGITS.map((digit) => <button key={digit} onClick={() => place(digit)}>{digit}</button>)}
        <button onClick={() => place(0)}>지우기</button>
        <button onClick={() => { setValues(copyPuzzle()); setSelected(null); }}>처음 판</button>
      </div>
    </main>
  );
}
