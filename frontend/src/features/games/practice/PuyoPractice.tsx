/**
 * PuyoPractice.tsx — 대기 중인 뿌요뿌요 대전 방에서 혼자 연습
 *
 * 조작·중력·최고 점수 저장은 테트리스 연습과 같다. 같은 puyoReducer를 쓰지만 서버와는 주고받지 않는다.
 * 방장이 고른 색 수(3·4·5)를 처음 값으로 쓴다.
 */
import { useEffect, useReducer, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { z } from "zod";
import { GameRankingSubmitPanel } from "@/features/games/ranking/components/GameRankingSubmitPanel";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import { GameStats } from "@/features/games/shared/GameStats";
import { puyoKeyActions as keyActions } from "@/features/games/puyo/puyoControls";
import { PuyoPreview } from "@/features/games/puyo/PuyoPreview";
import {
  createDisplayBoard,
  createPuyoSeed,
  createPuyoState,
  gravityInterval,
  PREVIEW_COUNT,
  puyoReducer,
  type ColorCount,
  type PuyoAction,
} from "@/features/games/puyo/puyoLogic";

const BEST_SCORE_KEY = "puyo.best";
const bestScoreSchema = z.number().int().nonnegative();

export const PuyoPractice = ({ nickname, colorCount }: { nickname: string; colorCount: ColorCount }) => {
  const [state, dispatch] = useReducer(puyoReducer, undefined, () => createPuyoState());
  const [storedBest, setStoredBest] = useState(() => readGameRecord(BEST_SCORE_KEY, bestScoreSchema) ?? 0);
  const stageRef = useRef<HTMLDivElement>(null);

  const { status, score, maxChain } = state;
  useEffect(() => {
    if (status !== "PLAYING") return;
    const timerId = window.setInterval(() => dispatch({ type: "TICK" }), gravityInterval(maxChain));
    return () => window.clearInterval(timerId);
  }, [status, maxChain]);

  useEffect(() => {
    if (status === "GAME_OVER" && score > storedBest) writeGameRecord(BEST_SCORE_KEY, score);
  }, [status, score, storedBest]);

  const start = () => {
    setStoredBest((previous) => Math.max(previous, score));
    dispatch({ type: "START", seed: createPuyoSeed(), colorCount });
    stageRef.current?.focus({ preventScroll: true });
  };

  const press = (action: PuyoAction) => {
    dispatch(action);
    stageRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isOnInnerButton = event.target !== event.currentTarget;
    if (isOnInnerButton && (event.key === "Enter" || event.key === " ")) return;
    if (event.key === "Enter") {
      if (status === "READY" || status === "GAME_OVER") {
        event.preventDefault();
        start();
      }
      return;
    }
    const action = keyActions[event.key];
    if (!action) return;
    event.preventDefault();
    if (event.repeat && (action.type === "HARD_DROP" || action.type === "TOGGLE_PAUSE")) return;
    dispatch(action);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    dispatch({ type: "PAUSE" });
  };

  const displayBoard = createDisplayBoard(state);
  const bestScore = Math.max(storedBest, score);
  const statusMessage = status === "READY" ? "시작 버튼이나 Enter를 누르세요."
    : status === "PAUSED" ? "일시정지 — P·Esc 또는 계속 버튼으로 이어서 합니다."
      : status === "GAME_OVER" ? `게임 끝! ${score.toLocaleString("ko-KR")}점${score > storedBest ? " — 새 최고 점수!" : ""}`
        : state.lastChain > 0 ? `${state.lastChain}연쇄!` : `최대 ${maxChain}연쇄 · ${colorCount}색`;

  return (
    <div className="practice-game">
      <div
        ref={stageRef}
        className="puyo-stage"
        role="application"
        tabIndex={0}
        aria-label="뿌요뿌요 연습 영역. ←→ 이동, ↓ 내리기, ↑·X 회전, Z 반대 회전, Space 바로 떨어뜨리기, P 일시정지"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      >
        <aside className="puyo-side puyo-side-stats">
          <GameStats items={[
            { label: "점수", value: score.toLocaleString("ko-KR") },
            { label: "최고 점수", value: bestScore.toLocaleString("ko-KR") },
            { label: "최대 연쇄", value: maxChain },
            { label: "색", value: `${colorCount}색` },
          ]} />
        </aside>

        <div className="puyo-board-wrap">
          <div className="puyo-board" role="img" aria-label={`뿌요뿌요 연습 판, ${status === "PLAYING" ? "게임 중" : status === "PAUSED" ? "일시정지" : status === "GAME_OVER" ? "게임 끝" : "시작 전"}`}>
            {displayBoard.map((row, rowIndex) => row.map((cell, colIndex) => (
              <span
                key={`${rowIndex}-${colIndex}`}
                className={cell ? `puyo-cell puyo-${cell.color.toLowerCase()}${cell.kind === "GHOST" ? " ghost" : ""}` : "puyo-cell"}
              />
            )))}
          </div>
          {status !== "PLAYING" ? (
            <div className="game-overlay">
              <strong>{status === "READY" ? "뿌요뿌요" : status === "PAUSED" ? "일시정지" : "게임 끝"}</strong>
              {status === "GAME_OVER" ? <span>{score.toLocaleString("ko-KR")}점 · 최대 {maxChain}연쇄</span> : null}
              {status === "PAUSED"
                ? <button type="button" onClick={() => press({ type: "TOGGLE_PAUSE" })}>계속 (P)</button>
                : <button type="button" onClick={start}>{status === "READY" ? "시작 (Enter)" : "다시 시작 (Enter)"}</button>}
            </div>
          ) : null}
        </div>

        <div className="puyo-touch-controls" role="group" aria-label="뿌요뿌요 조작 버튼">
          <button type="button" className="ghost-button" aria-label="반시계 방향 회전" disabled={status !== "PLAYING"} onClick={() => press({ type: "ROTATE", direction: "CCW" })}>⟲</button>
          <button type="button" className="ghost-button" aria-label="시계 방향 회전" disabled={status !== "PLAYING"} onClick={() => press({ type: "ROTATE", direction: "CW" })}>⟳</button>
          <button type="button" className="ghost-button" aria-label="왼쪽으로 이동" disabled={status !== "PLAYING"} onClick={() => press({ type: "MOVE", offset: -1 })}>←</button>
          <button type="button" className="ghost-button" aria-label="한 칸 내리기" disabled={status !== "PLAYING"} onClick={() => press({ type: "SOFT_DROP" })}>↓</button>
          <button type="button" className="ghost-button" aria-label="오른쪽으로 이동" disabled={status !== "PLAYING"} onClick={() => press({ type: "MOVE", offset: 1 })}>→</button>
          <button type="button" aria-label="바로 떨어뜨리기" disabled={status !== "PLAYING"} onClick={() => press({ type: "HARD_DROP" })}>⤓ 떨어뜨리기</button>
        </div>
        <aside className="puyo-side puyo-side-next">
          <section className="tetris-box">
            <h3>다음</h3>
            <div className="puyo-next-list">
              {state.queue.slice(0, PREVIEW_COUNT).map((pair, index) => <PuyoPreview key={`${index}-${pair.axis}${pair.child}`} pair={pair} />)}
            </div>
          </section>
          <button type="button" className="ghost-button" disabled={status !== "PLAYING" && status !== "PAUSED"} onClick={() => press({ type: "TOGGLE_PAUSE" })}>
            {status === "PAUSED" ? "계속" : "일시정지"} (P)
          </button>
        </aside>
      </div>

      <p className={`game-status${status === "GAME_OVER" ? " danger" : ""}`} aria-live="polite">{statusMessage}</p>

      {status === "GAME_OVER" ? (
        <GameRankingSubmitPanel gameCode="PUYO" record={{ score }} summary={`${score.toLocaleString("ko-KR")}점`} defaultNickname={nickname} />
      ) : null}
    </div>
  );
};
