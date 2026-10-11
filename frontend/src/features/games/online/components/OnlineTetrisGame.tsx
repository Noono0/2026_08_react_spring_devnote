/**
 * OnlineTetrisGame.tsx — 테트리스 대전 화면(2~6명)
 *
 * [화면 배치] 왼쪽에 내 판(보관 | 판 | 방해 줄 게이지 | 다음), 오른쪽에 다른 플레이어 판을 3칸씩 격자로 놓는다.
 *   빈 자리도 빈 판으로 보여 몇 명이 더 들어올 수 있는지 알 수 있다. 관전자는 모든 플레이어 판을 격자로 본다.
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
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { toBoardText } from "@/features/games/online/onlineRoomHelpers";
import type { OnlineClientMessage, OnlineRoom, TetrisBattlePlayer } from "@/features/games/online/onlineTypes";
import { PiecePreview } from "@/features/games/tetris/PiecePreview";
import { tetrisKeyActions } from "@/features/games/tetris/tetrisControls";
import {
  createDisplayBoard,
  createTetrisState,
  gravityInterval,
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

const EMPTY_BOARD_TEXT = ".".repeat(200);
/** 다음 칸: 큰 칸 1개 + 작은 칸 3개(대기열은 항상 4개 이상 채워져 있다) */
const NEXT_PREVIEW_COUNT = 4;

/** 오른쪽 격자의 한 칸. 게임 중이면 서버가 보낸 판 요약, 시작 전이면 자리에 앉은 사람 이름과 빈 판 */
interface PlayerSlot {
  seatIndex: number;
  nickname: string | null; // null = 빈 자리
  player: TetrisBattlePlayer | null;
}

/** 다른 플레이어 카드: 이름표 + 작은 판(200글자 요약을 칸으로) */
const OpponentCard = ({ slot, isHost }: { slot: PlayerSlot; isHost: boolean }) => {
  const { player } = slot;
  const out = player !== null && !player.alive;
  const label = slot.nickname === null ? `${slot.seatIndex + 1}번 빈 자리`
    : `${slot.nickname} 판${player ? `, 점수 ${player.score}${out ? `, ${player.rank}위로 탈락` : ""}` : ""}`;
  return (
    <figure className={`tetris-opponent${slot.nickname === null ? " empty" : ""}${out ? " out" : ""}`} aria-label={label}>
      <figcaption className="tetris-nameplate">
        <strong>{slot.nickname ?? "빈 자리"}</strong>
        {isHost ? <span className="tetris-host-mark">방장</span> : null}
        <span>{player ? (out ? `탈락 · ${player.rank}위` : `${player.score.toLocaleString("ko-KR")}점 · ${player.lines}줄`) : slot.nickname ? "준비" : "대기"}</span>
      </figcaption>
      <div className="tetris-opponent-board" aria-hidden="true">
        {[...(player?.board ?? EMPTY_BOARD_TEXT)].map((cell, index) => <span key={index} className={cell === "." ? "tetris-cell" : `tetris-cell piece-${cell.toLowerCase()}`} />)}
        {out ? <span className="tetris-opponent-out">{player.rank}위</span> : null}
      </div>
    </figure>
  );
};

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

  // 5. 방해 줄을 받으면 내 판에 넣고, 게이지(판 오른쪽 빨간 막대)에 다음 블록이 굳을 때까지 표시한다
  const garbageSequence = incomingGarbage?.sequence ?? 0;
  const [garbageWarning, setGarbageWarning] = useState<{ lines: number; atPiece: number } | null>(null);
  useEffect(() => {
    if (!incomingGarbage || garbageSequence === appliedGarbageRef.current) return;
    appliedGarbageRef.current = garbageSequence;
    dispatch({ type: "ADD_GARBAGE", lines: incomingGarbage.lines, holeCol: incomingGarbage.holeCol });
    setGarbageWarning({ lines: incomingGarbage.lines, atPiece: pieceCount });
  }, [garbageSequence, incomingGarbage, pieceCount]);
  const warningLines = garbageWarning && garbageWarning.atPiece === pieceCount ? garbageWarning.lines : 0;

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

  const canControl = iAmAlive && connected && status === "PLAYING";
  const nicknameOf = (participantId: string | null) => room.participants.find((participant) => participant.participantId === participantId)?.nickname ?? null;
  const hostSeat = room.seats.findIndex((participantId) => participantId !== null && participantId === room.hostId);
  // 자리마다 한 칸. 게임 중(또는 끝난 직후)이면 서버의 판 요약을, 시작 전이면 앉은 사람 이름만
  const slots: PlayerSlot[] = room.seats.map((participantId, seatIndex) => {
    const player = tetris?.players[seatIndex] ?? null;
    return { seatIndex, nickname: player?.nickname ?? nicknameOf(participantId), player };
  });
  const otherSlots = slots.filter((slot) => slot.seatIndex !== mySeat);

  const others = (
    <section className={`tetris-arena-others${mySeat === null ? " spectator" : ""}`} aria-label={mySeat === null ? "플레이어 판" : "다른 플레이어 판"}>
      {otherSlots.map((slot) => <OpponentCard key={slot.seatIndex} slot={slot} isHost={slot.seatIndex === hostSeat} />)}
    </section>
  );

  // 관전자: 모든 플레이어 판을 격자로 본다
  if (mySeat === null) {
    return (
      <div className="online-tetris">
        {!tetris ? <p className="online-hint">플레이어가 모두 앉고 방장이 시작하면 판이 움직입니다. 같은 순서의 블록으로 겨루고, 2줄 이상 지우면 상대에게 방해 줄을 보냅니다.</p> : null}
        {others}
      </div>
    );
  }

  const displayBoard = createDisplayBoard(game);
  const [firstNext, ...restNext] = game.queue.slice(0, NEXT_PREVIEW_COUNT);
  return (
    <div className="online-tetris">
      <div className="tetris-arena">
        <section className="tetris-arena-me" aria-label="내 판">
          <div className="tetris-nameplate me">
            <strong>{nicknameOf(room.myParticipantId) ?? "나"}</strong>
            {mySeat === hostSeat ? <span className="tetris-host-mark">방장</span> : null}
            <span>{score.toLocaleString("ko-KR")}점 · {lines}줄 · Lv {level}</span>
          </div>
          <div
            ref={stageRef}
            className="tetris-arena-stage"
            role="application"
            tabIndex={0}
            aria-label="테트리스 대전 내 판. ←→ 이동, ↓ 내리기, ↑·X 회전, Z 반대 회전, Space 바로 떨어뜨리기, C 보관"
            onKeyDown={handleKeyDown}
          >
            <div className="tetris-arena-column">
              <span className="tetris-arena-label">HOLD</span>
              <div className="tetris-arena-slot large"><PiecePreview type={game.hold} dimmed={!game.canHold} /></div>
            </div>
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
                  {!roomPlaying && room.lastResult ? <span>{room.lastResult}</span> : null}
                </div>
              ) : null}
            </div>
            {/* 방해 줄 게이지: 받은 줄 수만큼 아래에서 위로 빨갛게 찬다(20줄 = 가득) */}
            <div className="tetris-garbage-meter" role="meter" aria-label="받은 방해 줄" aria-valuemin={0} aria-valuemax={20} aria-valuenow={warningLines}>
              <span style={{ height: `${Math.min(100, (warningLines / 20) * 100)}%` }} />
            </div>
            <div className="tetris-arena-column">
              <span className="tetris-arena-label">NEXT</span>
              <div className="tetris-arena-slot large"><PiecePreview type={firstNext ?? null} /></div>
              {restNext.map((type, index) => <div key={`${index}-${type}`} className="tetris-arena-slot"><PiecePreview type={type} /></div>)}
            </div>
          </div>
          {incomingGarbage && canControl && warningLines > 0 ? <p key={garbageSequence} className="online-tetris-attack" role="status">{incomingGarbage.fromNickname}님이 방해 줄 {incomingGarbage.lines}줄을 보냈습니다!</p> : null}
          <div className="tetris-touch-controls online" role="group" aria-label="테트리스 조작 버튼">
            <button type="button" className="ghost-button" disabled={!canControl} onClick={() => press({ type: "HOLD" })}>보관</button>
            <button type="button" className="ghost-button" aria-label="반시계 방향 회전" disabled={!canControl} onClick={() => press({ type: "ROTATE", direction: "CCW" })}>⟲</button>
            <button type="button" className="ghost-button" aria-label="시계 방향 회전" disabled={!canControl} onClick={() => press({ type: "ROTATE", direction: "CW" })}>⟳</button>
            <button type="button" className="ghost-button" aria-label="왼쪽으로 이동" disabled={!canControl} onClick={() => press({ type: "MOVE", offset: -1 })}>←</button>
            <button type="button" className="ghost-button" aria-label="한 칸 내리기" disabled={!canControl} onClick={() => press({ type: "SOFT_DROP" })}>↓</button>
            <button type="button" className="ghost-button" aria-label="오른쪽으로 이동" disabled={!canControl} onClick={() => press({ type: "MOVE", offset: 1 })}>→</button>
            <button type="button" aria-label="바로 떨어뜨리기" disabled={!canControl} onClick={() => press({ type: "HARD_DROP" })}>⤓ 떨어뜨리기</button>
          </div>
        </section>
        {others}
      </div>
      <p className="online-hint">2줄 지우면 1줄, 3줄은 2줄, 4줄(테트리스)은 4줄을 다음 상대에게 보냅니다. 받은 회색 줄은 빈칸을 채워 지우세요.</p>
    </div>
  );
};
