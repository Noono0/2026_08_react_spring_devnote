/**
 * TetrisPractice.tsx — 대기 중인 테트리스 대전 방에서 혼자 연습
 *
 * [조작] 게임 영역에 포커스가 있을 때
 *   ← → 이동 · ↓ 한 칸 내리기 · ↑ 또는 X 시계 방향 회전 · Z 반시계 회전
 *   Space 바로 떨어뜨리기 · C 또는 Shift 보관(hold) · P 또는 Esc 일시정지 · Enter 시작
 *
 * [중력 = setInterval]
 *   게임 중에만 일정 간격으로 TICK을 보낸다. 레벨이 오르면 간격이 짧아지므로 [status, level]이 바뀔 때마다
 *   이전 타이머를 cleanup으로 지우고 새 간격으로 다시 만든다.
 *   ★ 타이머 안에서는 dispatch만 부른다. dispatch는 항상 같은 함수라 오래된 상태(stale closure)를 붙잡을 걱정이 없다.
 *
 * [키보드는 window가 아니라 게임 영역에서 받는다]
 *   window에 달면 방 채팅에 글자를 칠 때도 방향키·Space가 게임으로 들어가 버린다.
 *   그래서 tabIndex=0인 게임 영역 div에서만 받고, 포커스가 게임 밖으로 나가면 자동으로 일시정지한다.
 *
 * [최고 점수 저장은 Effect로]
 *   게임 끝은 클릭이 아니라 타이머(TICK)에서도 생긴다. 그래서 "상태가 GAME_OVER가 되면 localStorage에 쓴다"를
 *   Effect로 맞춘다(외부 저장소와 동기화하는 일은 Effect의 역할).
 *
 * 테트리스 대전(OnlineTetrisGame)과 같은 tetrisReducer를 쓰지만 서버와 아무것도 주고받지 않는다.
 */
import { useEffect, useReducer, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { z } from "zod";
import { GameRankingSubmitPanel } from "@/features/games/ranking/components/GameRankingSubmitPanel";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import { GameStats } from "@/features/games/shared/GameStats";
import { PiecePreview } from "@/features/games/tetris/PiecePreview";
import { tetrisKeyActions as keyActions } from "@/features/games/tetris/tetrisControls";
import {
  createDisplayBoard,
  createTetrisSeed,
  createTetrisState,
  gravityInterval,
  PREVIEW_COUNT,
  tetrisReducer,
  type TetrisAction,
} from "@/features/games/tetris/tetrisLogic";

const BEST_SCORE_KEY = "tetris.best";
const bestScoreSchema = z.number().int().nonnegative();

const clearedLineNames = ["", "1줄", "2줄", "3줄", "테트리스!(4줄)"];

export const TetrisPractice = ({ nickname }: { nickname: string }) => {
  const [state, dispatch] = useReducer(tetrisReducer, undefined, () => createTetrisState());
  // 저장된 최고 점수. 게임 중에는 화면에 max(저장값, 지금 점수)를 보여 주고, 끝나면 저장한다.
  const [storedBest, setStoredBest] = useState(() => readGameRecord(BEST_SCORE_KEY, bestScoreSchema) ?? 0);
  const stageRef = useRef<HTMLDivElement>(null);

  const { status, level, score } = state;
  useEffect(() => {
    if (status !== "PLAYING") return;
    const timerId = window.setInterval(() => dispatch({ type: "TICK" }), gravityInterval(level));
    return () => window.clearInterval(timerId);
  }, [status, level]);

  useEffect(() => {
    if (status === "GAME_OVER" && score > storedBest) writeGameRecord(BEST_SCORE_KEY, score);
  }, [status, score, storedBest]);

  const start = () => {
    setStoredBest((previous) => Math.max(previous, score)); // 지난 판 점수를 최고 기록에 반영하고 새로 시작
    dispatch({ type: "START", seed: createTetrisSeed() });
    stageRef.current?.focus({ preventScroll: true });
  };

  /** 화면 버튼: 동작 후 포커스를 게임 영역으로 돌려 키보드를 이어서 쓸 수 있게 한다 */
  const press = (action: TetrisAction) => {
    dispatch(action);
    stageRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // 게임 영역 안의 버튼에 포커스가 있을 때 Enter·Space는 그 버튼을 누르는 키로 둔다
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
    event.preventDefault(); // 방향키·Space로 페이지가 스크롤되지 않게
    if (event.repeat && (action.type === "HARD_DROP" || action.type === "HOLD" || action.type === "TOGGLE_PAUSE")) return; // 꾹 누를 때 반복되면 곤란한 동작
    dispatch(action);
  };

  // 포커스가 게임 영역 밖으로 나가면(채팅 입력, 다른 탭 등) 자동 일시정지. 영역 안 버튼으로 옮기는 것은 제외
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    dispatch({ type: "PAUSE" }); // 토글이 아니라 "멈추기"라서, 이미 멈춘 게임이 다시 움직이는 일이 없다
  };

  const displayBoard = createDisplayBoard(state);
  const bestScore = Math.max(storedBest, score);
  const statusMessage = status === "READY" ? "시작 버튼이나 Enter를 누르세요."
    : status === "PAUSED" ? "일시정지 — P·Esc 또는 계속 버튼으로 이어서 합니다."
      : status === "GAME_OVER" ? `게임 끝! ${score.toLocaleString("ko-KR")}점${score > storedBest ? " — 새 최고 점수!" : ""}`
        : state.lastClearedLines > 0 ? `${clearedLineNames[state.lastClearedLines] ?? ""} 지웠습니다.` : `레벨 ${level}`;

  return (
    <div className="practice-game">
      <div
        ref={stageRef}
        className="tetris-stage"
        role="application"
        tabIndex={0}
        aria-label="테트리스 연습 영역. ←→ 이동, ↓ 내리기, ↑·X 회전, Z 반대 회전, Space 바로 떨어뜨리기, C 보관, P 일시정지"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      >
        <aside className="tetris-side tetris-side-hold">
          <section className="tetris-box">
            <h3>보관 <small>C</small></h3>
            <PiecePreview type={state.hold} dimmed={!state.canHold} />
          </section>
          <GameStats items={[
            { label: "점수", value: score.toLocaleString("ko-KR") },
            { label: "최고 점수", value: bestScore.toLocaleString("ko-KR") },
            { label: "줄", value: state.lines },
            { label: "레벨", value: level },
          ]} />
        </aside>

        <div className="tetris-board-wrap">
          <div className="tetris-board" role="img" aria-label={`테트리스 연습 판, ${status === "PLAYING" ? "게임 중" : status === "PAUSED" ? "일시정지" : status === "GAME_OVER" ? "게임 끝" : "시작 전"}`}>
            {displayBoard.map((row, rowIndex) => row.map((cell, colIndex) => (
              <span
                key={`${rowIndex}-${colIndex}`}
                className={cell ? `tetris-cell piece-${cell.type.toLowerCase()}${cell.kind === "GHOST" ? " ghost" : ""}` : "tetris-cell"}
              />
            )))}
          </div>
          {status !== "PLAYING" ? (
            <div className="game-overlay">
              <strong>{status === "READY" ? "테트리스" : status === "PAUSED" ? "일시정지" : "게임 끝"}</strong>
              {status === "GAME_OVER" ? <span>{score.toLocaleString("ko-KR")}점 · {state.lines}줄</span> : null}
              {status === "PAUSED"
                ? <button type="button" onClick={() => press({ type: "TOGGLE_PAUSE" })}>계속 (P)</button>
                : <button type="button" onClick={start}>{status === "READY" ? "시작 (Enter)" : "다시 시작 (Enter)"}</button>}
            </div>
          ) : null}
        </div>

        {/* 터치 화면용 버튼(좁은 화면·터치 기기에서만 보임). 키보드와 같은 action을 보낸다. 판 바로 아래에 두어 스크롤 없이 조작한다 */}
        <div className="tetris-touch-controls" role="group" aria-label="테트리스 조작 버튼">
          <button type="button" className="ghost-button" aria-label="보관" disabled={status !== "PLAYING"} onClick={() => press({ type: "HOLD" })}>보관</button>
          <button type="button" className="ghost-button" aria-label="반시계 방향 회전" disabled={status !== "PLAYING"} onClick={() => press({ type: "ROTATE", direction: "CCW" })}>⟲</button>
          <button type="button" className="ghost-button" aria-label="시계 방향 회전" disabled={status !== "PLAYING"} onClick={() => press({ type: "ROTATE", direction: "CW" })}>⟳</button>
          <button type="button" className="ghost-button" aria-label="왼쪽으로 이동" disabled={status !== "PLAYING"} onClick={() => press({ type: "MOVE", offset: -1 })}>←</button>
          <button type="button" className="ghost-button" aria-label="한 칸 내리기" disabled={status !== "PLAYING"} onClick={() => press({ type: "SOFT_DROP" })}>↓</button>
          <button type="button" className="ghost-button" aria-label="오른쪽으로 이동" disabled={status !== "PLAYING"} onClick={() => press({ type: "MOVE", offset: 1 })}>→</button>
          <button type="button" aria-label="바로 떨어뜨리기" disabled={status !== "PLAYING"} onClick={() => press({ type: "HARD_DROP" })}>⤓ 떨어뜨리기</button>
        </div>
        <aside className="tetris-side tetris-side-next">
          <section className="tetris-box">
            <h3>다음</h3>
            <div className="tetris-next-list">
              {state.queue.slice(0, PREVIEW_COUNT).map((type, index) => <PiecePreview key={`${index}-${type}`} type={type} />)}
            </div>
          </section>
          <button type="button" className="ghost-button" disabled={status !== "PLAYING" && status !== "PAUSED"} onClick={() => press({ type: "TOGGLE_PAUSE" })}>
            {status === "PAUSED" ? "계속" : "일시정지"} (P)
          </button>
        </aside>
      </div>

      <p className={`game-status${status === "GAME_OVER" ? " danger" : ""}`} aria-live="polite">{statusMessage}</p>

      {/* 게임 영역(키 입력을 받는 곳) 밖에 두어, 닉네임을 칠 때 글자가 게임 조작으로 들어가지 않게 한다 */}
      {status === "GAME_OVER" ? (
        <GameRankingSubmitPanel gameCode="TETRIS" record={{ score }} summary={`${score.toLocaleString("ko-KR")}점`} defaultNickname={nickname} />
      ) : null}
    </div>
  );
};
