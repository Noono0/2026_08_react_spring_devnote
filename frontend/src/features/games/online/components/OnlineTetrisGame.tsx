/**
 * OnlineTetrisGame.tsx — 테트리스 대전 화면(2~4명)
 *
 * [혼자 하기와 같은 규칙, 다른 점은 "서버와 나누는 것"뿐]
 *   블록 계산은 혼자 하기와 똑같은 tetrisReducer가 내 브라우저에서 한다(서버 부담 없음).
 *   서버와는 아래만 주고받는다.
 *     보내기: 블록이 굳을 때 내 판 요약(TETRIS_BOARD), 2줄 이상 지우면 공격(TETRIS_ATTACK), 쌓을 곳이 없으면 탈락(TETRIS_TOPPED_OUT)
 *     받기  : 판 시작(같은 seed → 모두 같은 블록 순서), 상대 판 요약(ROOM_STATE), 방해 줄(TETRIS_GARBAGE)
 *
 * [Effect로 서버와 맞추기]
 *   "판이 시작되면 내 게임 시작", "블록이 굳으면 판 보내기", "방해 줄이 오면 넣기"는 모두 "어떤 값이 바뀌면 바깥(서버·리듀서)과 맞추기"라
 *   useEffect로 한다. 같은 일을 두 번 하지 않도록 마지막으로 처리한 번호를 ref에 기억한다.
 *
 * 온라인 대전은 남이 기다려 주지 않으므로 일시정지가 없다.
 */
import { useEffect, useReducer, useRef, type KeyboardEvent } from "react";
import { toBoardText } from "@/features/games/online/onlineRoomHelpers";
import type { OnlineClientMessage, OnlineRoom, TetrisBattlePlayer } from "@/features/games/online/onlineTypes";
import { PiecePreview } from "@/features/games/tetris/PiecePreview";
import { tetrisKeyActions } from "@/features/games/tetris/tetrisControls";
import {
  createDisplayBoard,
  createTetrisState,
  gravityInterval,
  PREVIEW_COUNT,
  tetrisReducer,
  type TetrisAction,
} from "@/features/games/tetris/tetrisLogic";

interface OnlineTetrisGameProperties {
  room: OnlineRoom;
  mySeat: number | null;
  connected: boolean;
  incomingGarbage: { lines: number; holeCol: number; fromNickname: string; sequence: number } | null;
  send: (message: OnlineClientMessage) => boolean;
}

/** 상대 판 요약(200글자)을 작은 판으로 그린다 */
const MiniBoard = ({ player }: { player: TetrisBattlePlayer }) => (
  <figure className={`online-tetris-mini${player.alive ? "" : " out"}`} aria-label={`${player.nickname} 판, 점수 ${player.score}${player.alive ? "" : `, ${player.rank}위로 탈락`}`}>
    <div className="online-tetris-mini-board" aria-hidden="true">
      {[...player.board].map((cell, index) => <span key={index} className={cell === "." ? "tetris-cell" : `tetris-cell piece-${cell.toLowerCase()}`} />)}
    </div>
    <figcaption>
      <strong>{player.nickname}</strong>
      <span>{player.alive ? `${player.score.toLocaleString("ko-KR")}점 · ${player.lines}줄` : `탈락 · ${player.rank}위`}</span>
    </figcaption>
  </figure>
);

/** 온라인에서는 일시정지 키를 쓰지 않는다 */
const onlineKeyActions: Record<string, TetrisAction> = Object.fromEntries(
  Object.entries(tetrisKeyActions).filter(([, action]) => action.type !== "TOGGLE_PAUSE"),
);

export const OnlineTetrisGame = ({ room, mySeat, connected, incomingGarbage, send }: OnlineTetrisGameProperties) => {
  const [game, dispatch] = useReducer(tetrisReducer, undefined, () => createTetrisState());
  const stageRef = useRef<HTMLDivElement>(null);
  const sentPieceCountRef = useRef(0);
  const toppedOutSeedRef = useRef<number | null>(null);
  const appliedGarbageRef = useRef(0);

  const tetris = room.tetris;
  const roomPlaying = room.status === "PLAYING" && tetris != null;
  const myPlayer = mySeat != null ? tetris?.players[mySeat] : undefined;
  const iAmAlive = roomPlaying && myPlayer?.alive === true;
  const roundSeed = roomPlaying ? tetris.seed : null;

  // 1. 판이 시작되면(새 seed) 내 게임을 그 seed로 시작한다. 판이 끝나면 내 게임도 멈춘다.
  const iAmPlayer = mySeat != null;
  useEffect(() => {
    if (roundSeed === null) {
      dispatch({ type: "END" });
      return;
    }
    if (!iAmPlayer) return;
    sentPieceCountRef.current = 0;
    dispatch({ type: "START", seed: roundSeed });
    stageRef.current?.focus({ preventScroll: true });
  }, [roundSeed, iAmPlayer]);

  // 2. 중력: 혼자 하기와 같다(레벨이 오르면 빨라진다)
  const { status, level } = game;
  useEffect(() => {
    if (status !== "PLAYING") return;
    const timerId = window.setInterval(() => dispatch({ type: "TICK" }), gravityInterval(level));
    return () => window.clearInterval(timerId);
  }, [status, level]);

  // 3. 블록이 굳으면 내 판을 보내고, 2줄 이상 지웠으면 공격한다
  const { pieceCount, board, score, lines, lastClearedLines } = game;
  useEffect(() => {
    if (!iAmAlive || pieceCount === 0 || sentPieceCountRef.current === pieceCount) return;
    sentPieceCountRef.current = pieceCount;
    send({ type: "TETRIS_BOARD", board: toBoardText(board), score, lines });
    if (lastClearedLines >= 2) send({ type: "TETRIS_ATTACK", cleared: lastClearedLines });
  }, [iAmAlive, pieceCount, board, score, lines, lastClearedLines, send]);

  // 4. 쌓을 곳이 없어 끝나면 탈락을 알린다(한 판에 한 번)
  useEffect(() => {
    if (status !== "GAME_OVER" || !iAmAlive || roundSeed === null || toppedOutSeedRef.current === roundSeed) return;
    toppedOutSeedRef.current = roundSeed;
    send({ type: "TETRIS_BOARD", board: toBoardText(board), score, lines });
    send({ type: "TETRIS_TOPPED_OUT" });
  }, [status, iAmAlive, roundSeed, board, score, lines, send]);

  // 5. 방해 줄을 받으면 내 판에 넣는다
  const garbageSequence = incomingGarbage?.sequence ?? 0;
  useEffect(() => {
    if (!incomingGarbage || garbageSequence === appliedGarbageRef.current) return;
    appliedGarbageRef.current = garbageSequence;
    dispatch({ type: "ADD_GARBAGE", lines: incomingGarbage.lines, holeCol: incomingGarbage.holeCol });
  }, [garbageSequence, incomingGarbage]);

  const press = (action: TetrisAction) => {
    dispatch(action);
    stageRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = onlineKeyActions[event.key];
    if (!action) return;
    if (event.target !== event.currentTarget && event.key === " ") return; // 안쪽 버튼의 Space는 그 버튼을 누르는 키
    event.preventDefault();
    if (event.repeat && (action.type === "HARD_DROP" || action.type === "HOLD")) return;
    dispatch(action);
  };

  const players = tetris?.players ?? [];
  const opponents = players.filter((player) => player.seatIndex !== mySeat);
  const canControl = iAmAlive && connected && status === "PLAYING";

  // 관전자: 모두의 판을 크게 본다
  if (mySeat === null || (!roomPlaying && players.length === 0)) {
    return (
      <div className="online-tetris">
        {players.length === 0 ? <p className="online-hint">플레이어가 모두 앉고 방장이 시작하면 판이 보입니다. 같은 순서의 블록으로 겨루고, 2줄 이상 지우면 상대에게 방해 줄을 보냅니다.</p> : null}
        <div className="online-tetris-minis spectator">
          {players.map((player) => <MiniBoard key={player.seatIndex} player={player} />)}
        </div>
      </div>
    );
  }

  const displayBoard = createDisplayBoard(game);
  return (
    <div className="online-tetris">
      <div
        ref={stageRef}
        className="online-tetris-stage"
        role="application"
        tabIndex={0}
        aria-label="테트리스 대전 내 판. ←→ 이동, ↓ 내리기, ↑·X 회전, Z 반대 회전, Space 바로 떨어뜨리기, C 보관"
        onKeyDown={handleKeyDown}
      >
        <aside className="tetris-side">
          <section className="tetris-box">
            <h2>보관 <small>C</small></h2>
            <PiecePreview type={game.hold} dimmed={!game.canHold} />
          </section>
          <section className="tetris-box">
            <h2>다음</h2>
            <div className="tetris-next-list">
              {game.queue.slice(0, PREVIEW_COUNT).map((type, index) => <PiecePreview key={`${index}-${type}`} type={type} />)}
            </div>
          </section>
        </aside>
        <div className="tetris-board-wrap">
          <div className="tetris-board" role="img" aria-label={`내 판, 점수 ${score}점, ${lines}줄`}>
            {displayBoard.map((row, rowIndex) => row.map((cell, colIndex) => (
              <span key={`${rowIndex}-${colIndex}`} className={cell ? `tetris-cell piece-${cell.type.toLowerCase()}${cell.kind === "GHOST" ? " ghost" : ""}` : "tetris-cell"} />
            )))}
          </div>
          {!canControl ? (
            <div className="game-overlay">
              <strong>{roomPlaying ? (iAmAlive ? "연결 중..." : `탈락 · ${myPlayer?.rank ?? "-"}위`) : room.lastResult ? "게임 끝" : "대기 중"}</strong>
              {roomPlaying && !iAmAlive ? <span>다른 사람의 판을 지켜보세요</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      <dl className="game-stats online-tetris-stats">
        <div><dt>점수</dt><dd>{score.toLocaleString("ko-KR")}</dd></div>
        <div><dt>줄</dt><dd>{lines}</dd></div>
        <div><dt>레벨</dt><dd>{level}</dd></div>
      </dl>
      {incomingGarbage && canControl ? <p key={garbageSequence} className="online-tetris-attack" role="status">{incomingGarbage.fromNickname}님이 방해 줄 {incomingGarbage.lines}줄을 보냈습니다!</p> : null}

      <div className="tetris-touch-controls online" role="group" aria-label="테트리스 조작 버튼">
        <button type="button" className="ghost-button" disabled={!canControl} onClick={() => press({ type: "HOLD" })}>보관</button>
        <button type="button" className="ghost-button" aria-label="반시계 방향 회전" disabled={!canControl} onClick={() => press({ type: "ROTATE", direction: "CCW" })}>⟲</button>
        <button type="button" className="ghost-button" aria-label="시계 방향 회전" disabled={!canControl} onClick={() => press({ type: "ROTATE", direction: "CW" })}>⟳</button>
        <button type="button" className="ghost-button" aria-label="왼쪽으로 이동" disabled={!canControl} onClick={() => press({ type: "MOVE", offset: -1 })}>←</button>
        <button type="button" className="ghost-button" aria-label="한 칸 내리기" disabled={!canControl} onClick={() => press({ type: "SOFT_DROP" })}>↓</button>
        <button type="button" className="ghost-button" aria-label="오른쪽으로 이동" disabled={!canControl} onClick={() => press({ type: "MOVE", offset: 1 })}>→</button>
        <button type="button" aria-label="바로 떨어뜨리기" disabled={!canControl} onClick={() => press({ type: "HARD_DROP" })}>⤓ 떨어뜨리기</button>
      </div>

      {opponents.length > 0 ? (
        <section className="online-tetris-opponents" aria-label="상대 판">
          <h2>상대 판</h2>
          <div className="online-tetris-minis">
            {opponents.map((player) => <MiniBoard key={player.seatIndex} player={player} />)}
          </div>
        </section>
      ) : null}
      <p className="online-hint">2줄 지우면 1줄, 3줄은 2줄, 4줄(테트리스)은 4줄을 다음 상대에게 보냅니다. 받은 회색 줄은 빈칸을 채워 지우세요.</p>
    </div>
  );
};
