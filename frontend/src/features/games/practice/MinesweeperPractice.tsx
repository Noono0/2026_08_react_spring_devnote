/**
 * MinesweeperPractice.tsx — 대기 중인 지뢰 찾기 대전 방에서 혼자 연습
 *
 * 처음 난이도는 방장이 고른 게임 옵션과 같다. 연습 중에는 난이도를 바꿀 수 있고, 서버와는 주고받지 않는다.
 *
 * [조작] 왼쪽 클릭 = 열기, 오른쪽 클릭 = 깃발. 열린 숫자를 누르면 주변 깃발 수가 맞을 때 나머지를 연다(chord).
 *   터치에는 오른쪽 클릭이 없으므로 "깃발 모드"를 켠다. 키보드는 방향키 이동 · Enter·Space 열기 · F 깃발.
 * [로빙 탭인덱스] 칸이 많아 모두 Tab으로 거치면 판을 빠져나가기 어렵다. "지금 칸" 하나만 tabIndex=0.
 * [첫 클릭은 안전] 지뢰는 첫 클릭 뒤에 그 칸과 이웃을 피해 놓는다.
 */
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { z } from "zod";
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
} from "@/features/games/minesweeper/minesweeperLogic";
import { GameRankingSubmitPanel } from "@/features/games/ranking/components/GameRankingSubmitPanel";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import { GameStats } from "@/features/games/shared/GameStats";

const RECORD_KEY = "minesweeper.best";
const secondsSchema = z.number().int().nonnegative();
const bestTimesSchema = z.object({ BEGINNER: secondsSchema.optional(), INTERMEDIATE: secondsSchema.optional(), EXPERT: secondsSchema.optional() });
type BestTimes = z.infer<typeof bestTimesSchema>;

const difficultyOrder: MinesweeperDifficulty[] = ["BEGINNER", "INTERMEDIATE", "EXPERT"];
const arrowOffsets: Record<string, Position> = {
  ArrowUp: { row: -1, col: 0 }, ArrowDown: { row: 1, col: 0 }, ArrowLeft: { row: 0, col: -1 }, ArrowRight: { row: 0, col: 1 },
};

const cellText = (cell: MineCell, state: MinesweeperState): string => {
  const isOver = state.status === "LOST";
  if (cell.state === "FLAGGED") return isOver && !cell.mine ? "❌" : "🚩";
  if (cell.state === "HIDDEN") return "";
  if (cell.mine) return "💣";
  return cell.adjacentMines === 0 ? "" : String(cell.adjacentMines);
};

const cellLabel = (cell: MineCell, row: number, col: number): string => {
  const position = `${row + 1}행 ${col + 1}열`;
  if (cell.state === "FLAGGED") return `${position}, 깃발`;
  if (cell.state === "HIDDEN") return `${position}, 닫힘`;
  if (cell.mine) return `${position}, 지뢰`;
  return cell.adjacentMines === 0 ? `${position}, 빈 칸` : `${position}, 주변 지뢰 ${cell.adjacentMines}개`;
};

const faceByStatus = { READY: "🙂", PLAYING: "🙂", WON: "😎", LOST: "😵" } as const;

export const MinesweeperPractice = ({ nickname, difficulty: initialDifficulty }: { nickname: string; difficulty: MinesweeperDifficulty }) => {
  const [state, dispatch] = useReducer(minesweeperReducer, initialDifficulty, createMinesweeperState);
  const [storedTimes, setStoredTimes] = useState<BestTimes>(() => readGameRecord(RECORD_KEY, bestTimesSchema) ?? {});
  const [isFlagMode, setIsFlagMode] = useState(false);
  const [focusedCell, setFocusedCell] = useState<Position>({ row: 0, col: 0 });
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

  useEffect(() => {
    if (isNewRecord) writeGameRecord(RECORD_KEY, { ...storedTimes, [difficulty]: elapsedSeconds });
  }, [isNewRecord, storedTimes, difficulty, elapsedSeconds]);

  const reveal = (row: number, col: number) => dispatch({ type: "REVEAL", row, col, seed: createRevealSeed() });
  const toggleFlag = (row: number, col: number) => dispatch({ type: "TOGGLE_FLAG", row, col });

  const restart = (nextDifficulty: MinesweeperDifficulty) => {
    if (isNewRecord) setStoredTimes({ ...storedTimes, [difficulty]: elapsedSeconds });
    dispatch({ type: "RESTART", difficulty: nextDifficulty });
    setFocusedCell({ row: 0, col: 0 });
  };

  const handleCellClick = (row: number, col: number) => {
    setFocusedCell({ row, col });
    if (isFlagMode && state.board[row]?.[col]?.state !== "REVEALED") toggleFlag(row, col);
    else reveal(row, col);
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
    <div className="practice-game">
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

      {state.status === "WON" ? (
        <GameRankingSubmitPanel gameCode="MINESWEEPER" difficulty={difficulty} record={{ elapsedSeconds }} summary={`${minesweeperDifficulties[difficulty].label} ${elapsedSeconds}초`} defaultNickname={nickname} />
      ) : null}

      <div className="minesweeper-scroll">
        <div
          className={`minesweeper-board${state.status === "LOST" || state.status === "WON" ? " finished" : ""}`}
          style={{ gridTemplateColumns: `repeat(${state.cols}, var(--mine-cell-size))` }}
          role="group"
          aria-label={`지뢰 찾기 연습 판 ${state.cols}×${state.rows}. 방향키로 이동, Enter 열기, F 깃발`}
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
                  if (element) cellButtonsRef.current.set(key, element);
                  else cellButtonsRef.current.delete(key);
                }}
                type="button"
                className={className}
                tabIndex={focusedCell.row === rowIndex && focusedCell.col === colIndex ? 0 : -1}
                aria-label={cellLabel(cell, rowIndex, colIndex)}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                onContextMenu={(event) => {
                  event.preventDefault();
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
  );
};
