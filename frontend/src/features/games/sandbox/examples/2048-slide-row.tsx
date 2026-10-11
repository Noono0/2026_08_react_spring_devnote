/**
 * 2048 — 직접 만들어 보기: 한 줄을 왼쪽으로 밀기(slideRow)
 *
 * 해 볼 것
 *  1. 아래 slideRow 함수를 완성하세요. 지금은 아무것도 밀지 않고 그대로 돌려줍니다.
 *     - 0(빈칸)을 빼고 숫자만 앞으로 모읍니다.            [2, 0, 2, 4] → [2, 2, 4]
 *     - 앞에서부터 같은 숫자 두 개가 붙어 있으면 합칩니다.  [2, 2, 4] → [4, 4]
 *       ★ 한 번 합쳐진 타일은 같은 이동에서 다시 합쳐지지 않습니다. [2, 2, 4] → [4, 4] (8이 아님)
 *     - 합친 값만큼 점수(gained)를 더하고, 뒤를 0으로 채워 길이를 맞춥니다. → [4, 4, 0, 0], gained 4
 *  2. 채점표가 모두 ✅가 되면 아래 판에서 방향키(또는 버튼)로 2048을 해 보세요.
 *     네 방향 이동(moveBoard)은 slideRow 하나에 "뒤집기·전치"를 더해 만들어 두었습니다.
 *  3. (도전) 점수가 가장 높았던 기록을 State로 보여 주세요.
 */
import { useEffect, useState } from "react";

// ── TODO: 여기를 완성하세요 ─────────────────────────────────────
function slideRow(row: number[]): { row: number[]; gained: number } {
  return { row: [...row], gained: 0 };
}
// ────────────────────────────────────────────────────────────────

type Board = number[][];
type Direction = "LEFT" | "RIGHT" | "UP" | "DOWN";

const transpose = (board: Board): Board => (board[0] ?? []).map((_, col) => board.map((row) => row[col] ?? 0));
const reverseRows = (board: Board): Board => board.map((row) => [...row].reverse());

/** 왼쪽 밀기만 만들고, 나머지 방향은 판을 돌려서 왼쪽 밀기로 바꾼 뒤 되돌린다 */
function moveBoard(board: Board, direction: Direction): { board: Board; gained: number } {
  const slideLeft = (target: Board) => {
    const slid = target.map((row) => slideRow(row));
    return { board: slid.map((result) => result.row), gained: slid.reduce((total, result) => total + result.gained, 0) };
  };
  if (direction === "LEFT") return slideLeft(board);
  if (direction === "RIGHT") {
    const result = slideLeft(reverseRows(board));
    return { board: reverseRows(result.board), gained: result.gained };
  }
  if (direction === "UP") {
    const result = slideLeft(transpose(board));
    return { board: transpose(result.board), gained: result.gained };
  }
  const result = slideLeft(reverseRows(transpose(board)));
  return { board: transpose(reverseRows(result.board)), gained: result.gained };
}

function addRandomTile(board: Board): Board {
  const empty = board.flatMap((row, rowIndex) => row.flatMap((value, colIndex) => (value === 0 ? [[rowIndex, colIndex]] : [])));
  const picked = empty[Math.floor(Math.random() * empty.length)];
  if (!picked) return board;
  const [targetRow, targetCol] = picked;
  return board.map((row, rowIndex) => row.map((value, colIndex) => (rowIndex === targetRow && colIndex === targetCol ? (Math.random() < 0.9 ? 2 : 4) : value)));
}

const newBoard = (): Board => addRandomTile(addRandomTile(Array.from({ length: 4 }, () => [0, 0, 0, 0])));

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

const cases: { input: number[]; row: number[]; gained: number; name: string }[] = [
  { input: [0, 2, 0, 4], row: [2, 4, 0, 0], gained: 0, name: "빈칸을 건너 앞으로 모은다" },
  { input: [2, 2, 0, 0], row: [4, 0, 0, 0], gained: 4, name: "같은 두 수를 합친다" },
  { input: [2, 2, 2, 2], row: [4, 4, 0, 0], gained: 8, name: "네 개면 두 쌍으로 합친다" },
  { input: [2, 2, 4, 0], row: [4, 4, 0, 0], gained: 4, name: "합쳐진 타일은 다시 합치지 않는다" },
  { input: [4, 2, 2, 0], row: [4, 4, 0, 0], gained: 4, name: "앞에서부터 짝을 찾는다" },
  { input: [2, 4, 2, 4], row: [2, 4, 2, 4], gained: 0, name: "합칠 것이 없으면 그대로" },
];

function runChecks(): Check[] {
  try {
    const results = cases.map((testCase): Check => {
      const result = slideRow(testCase.input);
      const pass = result.row.join() === testCase.row.join() && result.gained === testCase.gained;
      return { name: testCase.name, pass, detail: `[${testCase.input.join(", ")}] → [${result.row.join(", ")}] +${result.gained}` };
    });
    const original = [2, 2, 0, 0];
    slideRow(original);
    return [...results, { name: "원본 배열을 바꾸지 않는다", pass: original.join() === "2,2,0,0" }];
  } catch (error) {
    return [{ name: "slideRow 실행 중 오류", pass: false, detail: String(error) }];
  }
}

const keyDirections: Record<string, Direction> = { ArrowLeft: "LEFT", ArrowRight: "RIGHT", ArrowUp: "UP", ArrowDown: "DOWN" };

export default function App() {
  const checks = runChecks();
  const [board, setBoard] = useState(newBoard);
  const [score, setScore] = useState(0);

  const move = (direction: Direction) => {
    const result = moveBoard(board, direction);
    if (result.board.flat().join() === board.flat().join()) return; // 움직이지 않았으면 새 타일도 없음
    setBoard(addRandomTile(result.board));
    setScore((previous) => previous + result.gained);
  };

  // 미리보기 창에서 방향키를 받는다. move가 바뀔 때마다(=board가 바뀔 때마다) 새 함수로 다시 등록하고 이전 것은 지운다
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = keyDirections[event.key];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <main>
      <h1>slideRow 채점표</h1>
      <ul>
        {checks.map((check) => (
          <li key={check.name}>
            {check.pass ? "✅" : "❌"} {check.name}
            {check.detail ? <small> — {check.detail}</small> : null}
          </li>
        ))}
      </ul>

      <h2>2048 · 점수 {score}</h2>
      <p>미리보기를 한 번 누른 뒤 방향키로 움직이세요.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 56px)", gap: 6 }}>
        {board.flat().map((value, index) => (
          <div key={index} style={{ height: 56, display: "grid", placeItems: "center", borderRadius: 6, fontWeight: 700, background: value ? `hsl(${30 + Math.log2(value) * 12}, 80%, ${90 - Math.log2(value) * 4}%)` : "rgba(127,127,127,.2)", color: "#222" }}>
            {value || ""}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
        <button onClick={() => move("LEFT")}>←</button>
        <button onClick={() => move("UP")}>↑</button>
        <button onClick={() => move("DOWN")}>↓</button>
        <button onClick={() => move("RIGHT")}>→</button>
        <button onClick={() => { setBoard(newBoard()); setScore(0); }}>새 게임</button>
      </div>
    </main>
  );
}
