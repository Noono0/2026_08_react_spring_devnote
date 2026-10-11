/**
 * MinesweeperPage.tsx — 지뢰 찾기 화면
 *
 * [조작]
 *   - 마우스: 왼쪽 클릭 = 열기, 오른쪽 클릭 = 깃발. 열린 숫자를 누르면 주변 깃발 수가 맞을 때 나머지 이웃을 연다(chord).
 *   - 터치: "깃발 모드"를 켜면 누를 때 깃발을 꽂는다(터치에는 오른쪽 클릭이 없으므로).
 *   - 키보드: 판 안에서 방향키로 칸 이동, Enter·Space = 열기, F = 깃발
 *
 * [로빙 탭인덱스(roving tabindex)]
 *   칸이 최대 480개라 모두 Tab으로 거치면 판을 빠져나가기 어렵다.
 *   그래서 "지금 칸" 하나만 tabIndex=0, 나머지는 -1로 두고 방향키로 지금 칸을 옮긴다.
 *   포커스는 DOM 작업이라 칸 버튼들을 ref로 모아 두고 focus()를 부른다.
 *
 * [첫 클릭은 안전]
 *   지뢰는 첫 클릭 순간에 놓는다(그 칸과 이웃은 피함). 놓을 무작위 시드를 REVEAL action에 담아 리듀서를 순수하게 유지한다.
 *
 * [최고 기록] 카드 짝 맞추기와 같은 방법: 저장값 State + 그릴 때 "새 기록인가?" 계산 + useEffect로 localStorage에 저장
 */
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { z } from "zod";
import { GamePageShell, GameStats } from "@/features/games/shared/GamePageShell";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import minesweeperSandboxSource from "@/features/games/sandbox/examples/minesweeper-reveal-area.tsx?raw";
import {
  createMinesweeperState,
  createRevealSeed,
  isBetterTime,
  minesweeperDifficulties,
  minesweeperReducer,
  remainingMines,
  type MineCell,
  type MinesweeperDifficulty,
  type MinesweeperState,
  type Position,
} from "./minesweeperLogic";

const RECORD_KEY = "minesweeper.best";
const secondsSchema = z.number().int().nonnegative();
const bestTimesSchema = z.object({ BEGINNER: secondsSchema.optional(), INTERMEDIATE: secondsSchema.optional(), EXPERT: secondsSchema.optional() });
type BestTimes = z.infer<typeof bestTimesSchema>;

const difficultyOrder: MinesweeperDifficulty[] = ["BEGINNER", "INTERMEDIATE", "EXPERT"];

const arrowOffsets: Record<string, Position> = {
  ArrowUp: { row: -1, col: 0 }, ArrowDown: { row: 1, col: 0 }, ArrowLeft: { row: 0, col: -1 }, ArrowRight: { row: 0, col: 1 },
};

/** 칸에 보일 글자 */
const cellText = (cell: MineCell, state: MinesweeperState): string => {
  const isOver = state.status === "LOST";
  if (cell.state === "FLAGGED") return isOver && !cell.mine ? "❌" : "🚩"; // 진 뒤에는 틀린 깃발을 ❌로
  if (cell.state === "HIDDEN") return "";
  if (cell.mine) return "💣";
  return cell.adjacentMines === 0 ? "" : String(cell.adjacentMines);
};

/** 화면 낭독기용 칸 설명 */
const cellLabel = (cell: MineCell, row: number, col: number): string => {
  const position = `${row + 1}행 ${col + 1}열`;
  if (cell.state === "FLAGGED") return `${position}, 깃발`;
  if (cell.state === "HIDDEN") return `${position}, 닫힘`;
  if (cell.mine) return `${position}, 지뢰`;
  return cell.adjacentMines === 0 ? `${position}, 빈 칸` : `${position}, 주변 지뢰 ${cell.adjacentMines}개`;
};

const faceByStatus = { READY: "🙂", PLAYING: "🙂", WON: "😎", LOST: "😵" } as const;

export const MinesweeperPage = () => {
  const [state, dispatch] = useReducer(minesweeperReducer, "BEGINNER", createMinesweeperState);
  const [storedTimes, setStoredTimes] = useState<BestTimes>(() => readGameRecord(RECORD_KEY, bestTimesSchema) ?? {});
  const [isFlagMode, setIsFlagMode] = useState(false);
  const [focusedCell, setFocusedCell] = useState<Position>({ row: 0, col: 0 });
  // 칸 버튼들. "행-열" → 버튼. 화면에 그릴 값이 아니라 DOM을 가리키는 값이라 ref에 둔다.
  const cellButtonsRef = useRef(new Map<string, HTMLButtonElement>());

  const isPlaying = state.status === "PLAYING";
  useEffect(() => {
    if (!isPlaying) return;
    const timerId = window.setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => window.clearInterval(timerId);
  }, [isPlaying]);

  const { difficulty, elapsedSeconds } = state;
  const storedBest = storedTimes[difficulty] ?? null;
  const isNewRecord = state.status === "WON" && isBetterTime(elapsedSeconds, storedBest);
  const best = isNewRecord ? elapsedSeconds : storedBest;

  // 새 최고 기록이면 브라우저에 저장한다(이긴 뒤에는 시간이 멈추므로 한 번만 저장된다)
  useEffect(() => {
    if (isNewRecord) writeGameRecord(RECORD_KEY, { ...storedTimes, [difficulty]: elapsedSeconds });
  }, [isNewRecord, storedTimes, difficulty, elapsedSeconds]);

  const reveal = (row: number, col: number) => dispatch({ type: "REVEAL", row, col, seed: createRevealSeed() });
  const toggleFlag = (row: number, col: number) => dispatch({ type: "TOGGLE_FLAG", row, col });

  const restart = (nextDifficulty: MinesweeperDifficulty) => {
    if (isNewRecord) setStoredTimes({ ...storedTimes, [difficulty]: elapsedSeconds }); // 불변성: 새 객체
    dispatch({ type: "RESTART", difficulty: nextDifficulty });
    setFocusedCell({ row: 0, col: 0 });
  };

  const handleCellClick = (row: number, col: number) => {
    setFocusedCell({ row, col });
    if (isFlagMode && state.board[row]?.[col]?.state !== "REVEALED") toggleFlag(row, col);
    else reveal(row, col); // 깃발 모드여도 열린 숫자를 누르면 chord
  };

  const handleBoardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const offset = arrowOffsets[event.key];
    if (offset) {
      event.preventDefault();
      const next = {
        row: Math.min(state.rows - 1, Math.max(0, focusedCell.row + offset.row)),
        col: Math.min(state.cols - 1, Math.max(0, focusedCell.col + offset.col)),
      };
      setFocusedCell(next);
      cellButtonsRef.current.get(`${next.row}-${next.col}`)?.focus();
      return;
    }
    if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      toggleFlag(focusedCell.row, focusedCell.col);
    }
  };

  const statusMessage = state.status === "WON"
    ? `모든 지뢰를 피했습니다! ${elapsedSeconds}초${isNewRecord ? " — 새 최고 기록!" : ""}`
    : state.status === "LOST" ? "지뢰를 밟았습니다. 얼굴 버튼이나 새 게임으로 다시 시작하세요."
      : state.status === "READY" ? "아무 칸이나 눌러 시작하세요. 첫 칸과 그 주변에는 지뢰가 없습니다." : "숫자는 주변 8칸의 지뢰 수입니다.";

  return (
    <GamePageShell
      kicker="Game · Minesweeper"
      title="지뢰 찾기"
      description="숫자 힌트로 지뢰 위치를 추리해 지뢰가 아닌 칸을 모두 엽니다. 첫 클릭은 항상 안전합니다."
      learningPoints={[
        "BFS(너비 우선 탐색): 주변에 지뢰가 없는 칸을 열면 큐로 이웃을 차례로 넓혀 엽니다. 아래 편집기에서 직접 만들어 봅니다.",
        "불변 2차원 배열: 판을 복사한 뒤 바꿔 원래 State를 직접 고치지 않습니다.",
        "로빙 탭인덱스: 칸 수백 개 중 하나만 Tab으로 들어가고 방향키로 움직이는 접근성 패턴입니다.",
        "onContextMenu: 오른쪽 클릭 메뉴를 막고 깃발로 바꿉니다. 터치 화면은 깃발 모드로 대신합니다.",
      ]}
      sandbox={{ id: "game-minesweeper", heading: "빈 칸 연쇄 열기 직접 만들어 보기", description: "revealArea(BFS)를 완성하면 채점표가 ✅로 바뀌고 작은 지뢰판이 넓게 열립니다", source: minesweeperSandboxSource }}
    >
      <div className="game-panel">
        <div className="game-toolbar">
          <div className="segmented-buttons" role="group" aria-label="난이도">
            {difficultyOrder.map((option) => (
              <button key={option} type="button" className={option === difficulty ? "active" : ""} aria-pressed={option === difficulty} onClick={() => restart(option)}>
                {minesweeperDifficulties[option].label}
              </button>
            ))}
          </div>
          <button type="button" className={isFlagMode ? "" : "ghost-button"} aria-pressed={isFlagMode} onClick={() => setIsFlagMode((previous) => !previous)}>
            🚩 깃발 모드 {isFlagMode ? "켜짐" : "꺼짐"}
          </button>
        </div>

        <div className="minesweeper-header">
          <GameStats items={[
            { label: "남은 지뢰", value: remainingMines(state) },
            { label: "시간", value: `${state.elapsedSeconds}초` },
            { label: "최고 기록", value: best === null ? "없음" : `${best}초` },
          ]} />
          <button type="button" className="minesweeper-face" aria-label="새 게임" onClick={() => restart(difficulty)}>{faceByStatus[state.status]}</button>
        </div>

        <p className={`game-status${state.status === "WON" ? " success" : state.status === "LOST" ? " danger" : ""}`} aria-live="polite">{statusMessage}</p>

        {/* 고급(30열)은 좁은 화면에서 넘치므로 판만 가로로 스크롤한다 */}
        <div className="minesweeper-scroll">
          <div
            className={`minesweeper-board${state.status === "LOST" || state.status === "WON" ? " finished" : ""}`}
            style={{ gridTemplateColumns: `repeat(${state.cols}, var(--mine-cell-size))` }}
            role="group"
            aria-label={`지뢰 찾기 판 ${state.cols}×${state.rows}. 방향키로 이동, Enter 열기, F 깃발`}
            onKeyDown={handleBoardKeyDown}
          >
            {state.board.map((row, rowIndex) => row.map((cell, colIndex) => {
              const key = `${rowIndex}-${colIndex}`;
              const exploded = state.explodedAt?.row === rowIndex && state.explodedAt.col === colIndex;
              const className = [
                "mine-cell",
                cell.state === "REVEALED" ? "revealed" : "hidden",
                cell.state === "REVEALED" && !cell.mine && cell.adjacentMines > 0 ? `mine-number-${cell.adjacentMines}` : "",
                exploded ? "exploded" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={key}
                  ref={(element) => {
                    // 콜백 ref: 요소가 생기면 Map에 넣고, 사라지면(null) 뺀다
                    if (element) cellButtonsRef.current.set(key, element);
                    else cellButtonsRef.current.delete(key);
                  }}
                  type="button"
                  className={className}
                  tabIndex={focusedCell.row === rowIndex && focusedCell.col === colIndex ? 0 : -1}
                  aria-label={cellLabel(cell, rowIndex, colIndex)}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  onContextMenu={(event) => {
                    event.preventDefault(); // 브라우저 메뉴 대신 깃발
                    setFocusedCell({ row: rowIndex, col: colIndex });
                    toggleFlag(rowIndex, colIndex);
                  }}
                >
                  {cellText(cell, state)}
                </button>
              );
            }))}
          </div>
        </div>
      </div>
    </GamePageShell>
  );
};
