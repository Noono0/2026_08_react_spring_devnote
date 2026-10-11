/**
 * TetrisPage.tsx — 테트리스 화면
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
 *   window에 달면 아래 편집기(Sandpack)에서 글자를 칠 때도 방향키·Space가 게임으로 들어가 버린다.
 *   그래서 tabIndex=0인 게임 영역 div에서만 받고, 포커스가 게임 밖으로 나가면 자동으로 일시정지한다.
 *
 * [최고 점수 저장은 Effect로]
 *   게임 끝은 클릭이 아니라 타이머(TICK)에서도 생긴다. 그래서 "상태가 GAME_OVER가 되면 localStorage에 쓴다"를
 *   Effect로 맞춘다(외부 저장소와 동기화하는 일은 Effect의 역할).
 */
import { useEffect, useReducer, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { z } from "zod";
import { GamePageShell, GameStats } from "@/features/games/shared/GamePageShell";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import tetrisSandboxSource from "@/features/games/sandbox/examples/tetris-clear-lines.tsx?raw";
import {
  createDisplayBoard,
  createTetrisSeed,
  createTetrisState,
  gravityInterval,
  PREVIEW_COUNT,
  TETROMINO_SHAPES,
  tetrisReducer,
  type TetrisAction,
  type TetrominoType,
} from "./tetrisLogic";

const BEST_SCORE_KEY = "tetris.best";
const bestScoreSchema = z.number().int().nonnegative();

/** 키 → action. 같은 동작에 키를 두 개씩 둔 것은 키보드 배치마다 편한 키가 달라서다. */
const keyActions: Record<string, TetrisAction> = {
  ArrowLeft: { type: "MOVE", offset: -1 },
  ArrowRight: { type: "MOVE", offset: 1 },
  ArrowDown: { type: "SOFT_DROP" },
  ArrowUp: { type: "ROTATE", direction: "CW" },
  x: { type: "ROTATE", direction: "CW" },
  X: { type: "ROTATE", direction: "CW" },
  z: { type: "ROTATE", direction: "CCW" },
  Z: { type: "ROTATE", direction: "CCW" },
  " ": { type: "HARD_DROP" },
  c: { type: "HOLD" },
  C: { type: "HOLD" },
  Shift: { type: "HOLD" },
  p: { type: "TOGGLE_PAUSE" },
  P: { type: "TOGGLE_PAUSE" },
  Escape: { type: "TOGGLE_PAUSE" },
};

const clearedLineNames = ["", "1줄", "2줄", "3줄", "테트리스!(4줄)"];

/** 다음·보관 칸에 보여 줄 작은 블록. 모양 행렬에서 빈 줄을 빼고 그린다. */
const PiecePreview = ({ type, dimmed = false }: { type: TetrominoType | null; dimmed?: boolean }) => {
  if (!type) return <div className="tetris-preview-piece empty" aria-label="비어 있음" />;
  const rows = TETROMINO_SHAPES[type].filter((row) => row.some(Boolean));
  return (
    <div className={`tetris-preview-piece${dimmed ? " dimmed" : ""}`} role="img" aria-label={`${type} 블록`}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="tetris-preview-row">
          {row.map((filled, colIndex) => <span key={colIndex} className={filled ? `tetris-cell piece-${type.toLowerCase()}` : "tetris-cell blank"} />)}
        </div>
      ))}
    </div>
  );
};

export const TetrisPage = () => {
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

  // 포커스가 게임 영역 밖으로 나가면(편집기 클릭, 다른 탭 등) 자동 일시정지. 영역 안 버튼으로 옮기는 것은 제외
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
    <GamePageShell
      kicker="Game · Tetris"
      title="테트리스"
      description="떨어지는 블록을 돌리고 옮겨 가로줄을 채우면 줄이 지워집니다. 10줄마다 레벨이 오르고 빨라집니다."
      learningPoints={[
        "행렬 회전·충돌 검사: 블록을 2차원 배열로 두고 돌린 뒤, 벽·바닥·쌓인 블록과 겹치는지 확인합니다(막히면 옆으로 밀어 보는 월 킥).",
        "타이머와 리듀서: setInterval은 TICK만 보내고, 내리기·굳히기·줄 지우기는 모두 순수 리듀서가 합니다.",
        "7-bag: 7가지 블록을 한 자루에 넣어 섞어 꺼내므로 같은 블록이 너무 오래 안 나오는 일이 없습니다.",
        "포커스 관리: 키를 게임 영역에서만 받고, 포커스가 나가면 자동으로 일시정지합니다.",
      ]}
      sandbox={{ id: "game-tetris", heading: "줄 지우기 직접 만들어 보기", description: "clearLines 함수를 완성하면 채점표가 ✅로 바뀌고 칸을 채워 줄을 지울 수 있습니다", source: tetrisSandboxSource }}
    >
      <div className="game-panel">
        <div
          ref={stageRef}
          className="tetris-stage"
          role="application"
          tabIndex={0}
          aria-label="테트리스 게임 영역. ←→ 이동, ↓ 내리기, ↑·X 회전, Z 반대 회전, Space 바로 떨어뜨리기, C 보관, P 일시정지"
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        >
          <aside className="tetris-side tetris-side-hold">
            <section className="tetris-box">
              <h2>보관 <small>C</small></h2>
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
            <div className="tetris-board" role="img" aria-label={`테트리스 판, ${status === "PLAYING" ? "게임 중" : status === "PAUSED" ? "일시정지" : status === "GAME_OVER" ? "게임 끝" : "시작 전"}`}>
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
              <h2>다음</h2>
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

      </div>
    </GamePageShell>
  );
};
