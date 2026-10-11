/**
 * Game2048Page.tsx — 2048 화면
 *
 * [조작]
 *   - 키보드: 판을 누르거나 Tab으로 판에 포커스를 둔 뒤 방향키 또는 W·A·S·D
 *   - 화면 버튼: ↑ ← ↓ →
 *   - 터치·마우스: 판 위에서 밀기(스와이프). Pointer 이벤트 하나로 마우스·터치·펜을 모두 처리한다.
 *
 * [무작위 값은 action에 담아 보낸다]
 *   리듀서는 순수 함수여야 하므로 안에서 Math.random을 부르지 않는다.
 *   새 타일 자리·값을 고를 무작위 값 두 개를 화면에서 만들어 MOVE action에 담는다(createMoveRandomValues).
 *
 * [최고 점수 = 저장값 State + 그릴 때 계산 + Effect로 저장]
 *   화면에는 max(저장된 최고 점수, 지금 점수)를 보여 주고, 지금 점수가 더 크면 useEffect가 localStorage에 쓴다.
 *   ★ 이동 처리 함수에서 state로 다음 점수를 미리 계산하지 않는 이유:
 *     키를 아주 빠르게 연달아 누르면 다시 그려지기 전의 옛 state(오래된 클로저)로 계산해 점수가 틀릴 수 있다.
 */
import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { z } from "zod";
import { GameRankingSubmitPanel } from "@/features/games/ranking/components/GameRankingSubmitPanel";
import { GamePageShell, GameStats } from "@/features/games/shared/GamePageShell";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import game2048SandboxSource from "@/features/games/sandbox/examples/2048-slide-row.tsx?raw";
import {
  createGame2048State,
  createInitialBoard,
  createMoveRandomValues,
  game2048Reducer,
  highestTile,
  WIN_VALUE,
  type Direction,
} from "./game2048Logic";

const BEST_SCORE_KEY = "2048.best";
const bestScoreSchema = z.number().int().nonnegative();
/** 이만큼(px) 이상 밀어야 스와이프로 본다. 너무 작으면 그냥 누른 것도 이동이 된다. */
const SWIPE_THRESHOLD = 30;

const keyDirections: Record<string, Direction> = {
  ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
  w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT",
  W: "UP", S: "DOWN", A: "LEFT", D: "RIGHT",
};

const directionLabels: Record<Direction, string> = { UP: "위", DOWN: "아래", LEFT: "왼쪽", RIGHT: "오른쪽" };

const createGame = () => createGame2048State(createInitialBoard(Math.random));

/** 타일 값 → 색 클래스. 2048보다 큰 타일은 한 가지 색으로 */
const tileClassName = (value: number): string => (value === 0 ? "tile-empty" : value > WIN_VALUE ? "tile-super" : `tile-${value}`);

export const Game2048Page = () => {
  const [state, dispatch] = useReducer(game2048Reducer, undefined, createGame);
  const [storedBest, setStoredBest] = useState(() => readGameRecord(BEST_SCORE_KEY, bestScoreSchema) ?? 0);
  const boardRef = useRef<HTMLDivElement>(null);
  // 스와이프 시작 위치. 화면에 그릴 값이 아니므로 State가 아니라 ref에 둔다(바뀌어도 다시 그리지 않음).
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  // 화면을 열면 판에 포커스 → 바로 방향키로 할 수 있다. preventScroll: 포커스 때문에 화면이 튀지 않게
  useEffect(() => {
    boardRef.current?.focus({ preventScroll: true });
  }, []);

  const { score } = state;
  const bestScore = Math.max(storedBest, score);
  useEffect(() => {
    if (score > storedBest) writeGameRecord(BEST_SCORE_KEY, score);
  }, [score, storedBest]);

  const move = (direction: Direction) => dispatch({ type: "MOVE", direction, randomValues: createMoveRandomValues(Math.random) });

  const restart = () => {
    setStoredBest(bestScore); // 지난 판 점수를 최고 기록에 반영하고 새로 시작
    dispatch({ type: "RESTART", board: createInitialBoard(Math.random) });
    boardRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = keyDirections[event.key];
    if (!direction) return;
    event.preventDefault(); // 방향키로 페이지가 스크롤되지 않게
    move(direction);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) return;
    // 가로로 더 많이 밀었으면 좌우, 세로로 더 많이 밀었으면 상하
    if (Math.abs(deltaX) > Math.abs(deltaY)) move(deltaX > 0 ? "RIGHT" : "LEFT");
    else move(deltaY > 0 ? "DOWN" : "UP");
  };

  const statusMessage = state.status === "WON"
    ? `${WIN_VALUE}을 만들었습니다! 계속하거나 새 게임을 시작하세요.`
    : state.status === "LOST" ? `더 움직일 수 없습니다. 최종 점수 ${state.score}점` : "같은 숫자 두 개가 부딪치면 합쳐집니다.";

  return (
    <GamePageShell
      kicker="Game · 2048"
      title="2048"
      description="방향키·버튼·밀기로 타일을 한쪽으로 모읍니다. 같은 숫자가 부딪치면 합쳐지고, 2048 타일을 만들면 승리입니다."
      learningPoints={[
        "2차원 배열 다루기: 한 줄 밀기(slideRow) 하나만 만들고, 뒤집기·전치(transpose)로 네 방향에 재사용합니다.",
        "순수 리듀서: 무작위 값을 action에 담아 보내 리듀서 안에서 Math.random을 쓰지 않습니다.",
        "키보드·포인터 이벤트: 포커스된 판에서 방향키를 받고, Pointer 이벤트로 터치·마우스 밀기를 함께 처리합니다.",
        "useRef: 화면에 그리지 않는 값(밀기 시작 위치)은 State 대신 ref에 둡니다.",
      ]}
      sandbox={{ id: "game-2048", heading: "한 줄 밀기 직접 만들어 보기", description: "slideRow 함수를 완성하면 채점표가 ✅로 바뀌고 작은 2048 판이 움직입니다", source: game2048SandboxSource }}
    >
      <div className="game-panel">
        <div className="game-toolbar">
          <GameStats items={[
            { label: "점수", value: state.score.toLocaleString("ko-KR") },
            { label: "최고 점수", value: bestScore.toLocaleString("ko-KR") },
            { label: "가장 큰 타일", value: highestTile(state.board) },
          ]} />
          <button type="button" className="ghost-button" onClick={restart}>새 게임</button>
        </div>

        <p className={`game-status${state.status === "WON" ? " success" : state.status === "LOST" ? " danger" : ""}`} aria-live="polite">{statusMessage}</p>

        {/* 2048을 만들었을 때와 더 움직일 수 없을 때 모두 올릴 수 있다. 계속하기로 이어 가면 사라졌다가 끝날 때 다시 나온다 */}
        {state.status !== "PLAYING" ? (
          <GameRankingSubmitPanel gameCode="GAME_2048" record={{ score: state.score }} summary={`${state.score.toLocaleString("ko-KR")}점`} />
        ) : null}

        <div className="game-2048-stage">
          <div
            ref={boardRef}
            className="game-2048-board"
            role="grid"
            aria-label="2048 판. 방향키 또는 W·A·S·D로 움직입니다"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => { pointerStartRef.current = null; }}
          >
            {state.board.map((row, rowIndex) => (
              <div key={rowIndex} className="game-2048-row" role="row">
                {row.map((value, colIndex) => {
                  const isNew = state.addedTile?.row === rowIndex && state.addedTile.col === colIndex;
                  return (
                    // 새로 생긴 타일은 key에 moveCount를 섞어 매번 새 요소로 만든다 → 나타나는 효과가 다시 재생된다
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
              <strong>{state.status === "WON" ? `${WIN_VALUE} 달성!` : "게임 끝"}</strong>
              <span>점수 {state.score.toLocaleString("ko-KR")}</span>
              <div className="button-row">
                {state.status === "WON" ? <button type="button" onClick={() => { dispatch({ type: "CONTINUE" }); boardRef.current?.focus({ preventScroll: true }); }}>계속하기</button> : null}
                <button type="button" className={state.status === "WON" ? "ghost-button" : ""} onClick={restart}>새 게임</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="game-direction-pad" role="group" aria-label="방향 버튼">
          {(["UP", "LEFT", "DOWN", "RIGHT"] as const).map((direction) => (
            <button key={direction} type="button" className={`ghost-button direction-${direction.toLowerCase()}`} aria-label={`${directionLabels[direction]}으로 밀기`} disabled={state.status !== "PLAYING"} onClick={() => move(direction)}>
              {{ UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→" }[direction]}
            </button>
          ))}
        </div>
      </div>
    </GamePageShell>
  );
};
