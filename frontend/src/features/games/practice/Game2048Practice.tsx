/**
 * Game2048Practice.tsx — 대기 중인 2048 대전 방에서 혼자 연습
 *
 * 방장이 고른 목표 타일(256~2048)을 연습에도 쓴다. 밀기 규칙은 game2048Logic.ts와 같고, 서버와는 주고받지 않는다.
 *
 * [조작] 판에 포커스가 있을 때 방향키·W·A·S·D, 화면 버튼, 판 위에서 밀기(Pointer 이벤트).
 * [무작위 값은 action에 담아 보낸다] 리듀서는 순수해야 하므로 Math.random을 안에서 부르지 않는다.
 *
 * 방 채팅에 글자를 칠 때 방향키가 게임으로 들어가지 않게, 판을 처음 그릴 때 자동으로 포커스하지 않는다.
 */
import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { z } from "zod";
import {
  createGame2048State,
  createInitialBoard,
  createMoveRandomValues,
  game2048Reducer,
  highestTile,
  type Direction,
} from "@/features/games/game2048/game2048Logic";
import { directionLabels, keyDirections, tileClassName } from "@/features/games/online/games/game2048BattleRules";
import { GameRankingSubmitPanel } from "@/features/games/ranking/components/GameRankingSubmitPanel";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import { GameStats } from "@/features/games/shared/GameStats";

const BEST_SCORE_KEY = "2048.best";
const bestScoreSchema = z.number().int().nonnegative();
const SWIPE_THRESHOLD = 30;
const DIRECTION_ORDER: Direction[] = ["UP", "LEFT", "DOWN", "RIGHT"];
const DIRECTION_ARROWS: Record<Direction, string> = { UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→" };

export const Game2048Practice = ({ nickname, target }: { nickname: string; target: number }) => {
  const [state, dispatch] = useReducer(game2048Reducer, undefined, () => createGame2048State(createInitialBoard(Math.random), target));
  const [storedBest, setStoredBest] = useState(() => readGameRecord(BEST_SCORE_KEY, bestScoreSchema) ?? 0);
  const boardRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const { score } = state;
  const bestScore = Math.max(storedBest, score);
  useEffect(() => {
    if (score > storedBest) writeGameRecord(BEST_SCORE_KEY, score);
  }, [score, storedBest]);

  const move = (direction: Direction) => dispatch({ type: "MOVE", direction, randomValues: createMoveRandomValues(Math.random) });

  const restart = () => {
    setStoredBest(bestScore);
    dispatch({ type: "RESTART", board: createInitialBoard(Math.random), target });
    boardRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = keyDirections[event.key];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) move(deltaX > 0 ? "RIGHT" : "LEFT");
    else move(deltaY > 0 ? "DOWN" : "UP");
  };

  const statusMessage = state.status === "WON"
    ? `${state.target}을 만들었습니다! 계속하거나 새 게임을 시작하세요.`
    : state.status === "LOST" ? `더 움직일 수 없습니다. 최종 점수 ${state.score.toLocaleString("ko-KR")}점` : "같은 숫자 두 개가 부딪치면 합쳐집니다.";

  return (
    <div className="practice-game">
      <div className="game-toolbar">
        <GameStats items={[
          { label: "점수", value: state.score.toLocaleString("ko-KR") },
          { label: "최고 점수", value: bestScore.toLocaleString("ko-KR") },
          { label: "목표", value: state.target },
          { label: "가장 큰 타일", value: highestTile(state.board) },
        ]} />
        <button type="button" className="ghost-button" onClick={restart}>새 게임</button>
      </div>

      <p className={`game-status${state.status === "WON" ? " success" : state.status === "LOST" ? " danger" : ""}`} aria-live="polite">{statusMessage}</p>

      {state.status !== "PLAYING" ? (
        <GameRankingSubmitPanel gameCode="GAME_2048" record={{ score: state.score }} summary={`${state.score.toLocaleString("ko-KR")}점`} defaultNickname={nickname} />
      ) : null}

      <div className="game-2048-stage">
        <div
          ref={boardRef}
          className="game-2048-board"
          role="grid"
          aria-label={`2048 연습 판(목표 ${state.target}). 방향키 또는 W·A·S·D로 밉니다`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerDown={(event) => { pointerStartRef.current = { x: event.clientX, y: event.clientY }; }}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { pointerStartRef.current = null; }}
        >
          {state.board.map((row, rowIndex) => (
            <div key={rowIndex} className="game-2048-row" role="row">
              {row.map((value, colIndex) => {
                const isNew = state.addedTile?.row === rowIndex && state.addedTile.col === colIndex;
                return (
                  <div key={isNew ? `new-${state.moveCount}` : `${rowIndex}-${colIndex}`} role="gridcell" aria-label={value === 0 ? "빈칸" : String(value)} className={`game-2048-tile ${tileClassName(value)}${isNew ? " tile-new" : ""}`}>
                    {value === 0 ? "" : value}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {state.status !== "PLAYING" ? (
          <div className="game-overlay">
            <strong>{state.status === "WON" ? `${state.target} 완성!` : "게임 끝"}</strong>
            <span>점수 {state.score.toLocaleString("ko-KR")}</span>
            <div className="button-row">
              {state.status === "WON" ? <button type="button" onClick={() => { dispatch({ type: "CONTINUE" }); boardRef.current?.focus({ preventScroll: true }); }}>계속하기</button> : null}
              <button type="button" className={state.status === "WON" ? "ghost-button" : ""} onClick={restart}>새 게임</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="game-direction-pad" role="group" aria-label="방향 버튼">
        {DIRECTION_ORDER.map((direction) => (
          <button key={direction} type="button" className={`ghost-button direction-${direction.toLowerCase()}`} aria-label={`${directionLabels[direction]}으로 밀기`} disabled={state.status !== "PLAYING"} onClick={() => move(direction)}>
            {DIRECTION_ARROWS[direction]}
          </button>
        ))}
      </div>
    </div>
  );
};
