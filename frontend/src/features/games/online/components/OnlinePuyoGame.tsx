/**
 * OnlinePuyoGame.tsx — 뿌요뿌요 대전 화면(2~6명)
 *
 * 테트리스 대전과 같은 "중계" 방식이다. 떨어지는 계산은 각자 브라우저의 puyoReducer가 하고,
 * 서버와는 판 요약(PUYO_BOARD)·공격(PUYO_ATTACK)·탈락(PUYO_TOPPED_OUT)·받은 방해(PUYO_GARBAGE)만 주고받는다.
 * 모두 같은 seed와 색 수(방 옵션)로 시작해 같은 순서의 쌍을 받는다. 온라인은 일시정지가 없다.
 */
import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import type { OnlineClientMessage, OnlineRoom, PuyoBattlePlayer } from "@/features/games/online/onlineTypes";
import { PuyoPreview } from "@/features/games/puyo/PuyoPreview";
import { puyoKeyActions } from "@/features/games/puyo/puyoControls";
import {
  createDisplayBoard,
  createPuyoState,
  gravityInterval,
  parseColorCount,
  PREVIEW_COUNT,
  puyoReducer,
  toBoardText,
  type PuyoAction,
} from "@/features/games/puyo/puyoLogic";

interface OnlinePuyoGameProperties {
  room: OnlineRoom;
  mySeat: number | null;
  connected: boolean;
  incomingPuyoGarbage: { count: number; fromNickname: string; sequence: number } | null;
  send: (message: OnlineClientMessage) => boolean;
}

const EMPTY_BOARD_TEXT = ".".repeat(72);

interface PlayerSlot {
  seatIndex: number;
  nickname: string | null;
  player: PuyoBattlePlayer | null;
}

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
        <span>{player ? (out ? `탈락 · ${player.rank}위` : `${player.score.toLocaleString("ko-KR")}점 · ${player.chains}연쇄`) : slot.nickname ? "준비" : "대기"}</span>
      </figcaption>
      <div className="puyo-opponent-board" aria-hidden="true">
        {[...(player?.board ?? EMPTY_BOARD_TEXT)].map((cell, index) => (
          <span key={index} className={cell === "." ? "puyo-cell" : `puyo-cell puyo-${cell.toLowerCase()}`} />
        ))}
        {out ? <span className="tetris-opponent-out">{player.rank}위</span> : null}
      </div>
    </figure>
  );
};

const onlineKeyActions: Record<string, PuyoAction> = Object.fromEntries(
  Object.entries(puyoKeyActions).filter(([, action]) => action.type !== "TOGGLE_PAUSE"),
);

export const OnlinePuyoGame = ({ room, mySeat, connected, incomingPuyoGarbage, send }: OnlinePuyoGameProperties) => {
  const [game, dispatch] = useReducer(puyoReducer, undefined, () => createPuyoState());
  const stageRef = useRef<HTMLDivElement>(null);
  const sentPairCountRef = useRef(0);
  const toppedOutSeedRef = useRef<number | null>(null);
  const appliedGarbageRef = useRef(0);

  const puyo = room.puyo;
  const roomPlaying = room.status === "PLAYING" && puyo != null;
  const myPlayer = mySeat != null ? puyo?.players[mySeat] : undefined;
  const iAmAlive = roomPlaying && myPlayer?.alive === true;
  const roundSeed = roomPlaying ? puyo.seed : null;
  const colorCount = parseColorCount(room.gameOption);

  const iAmPlayer = mySeat != null;
  useEffect(() => {
    if (roundSeed === null) {
      dispatch({ type: "END" });
      return;
    }
    if (!iAmPlayer) return;
    sentPairCountRef.current = 0;
    dispatch({ type: "START", seed: roundSeed, colorCount });
    stageRef.current?.focus({ preventScroll: true });
  }, [roundSeed, iAmPlayer, colorCount]);

  const { status, maxChain } = game;
  useEffect(() => {
    if (status !== "PLAYING") return;
    const timerId = window.setInterval(() => dispatch({ type: "TICK" }), gravityInterval(maxChain));
    return () => window.clearInterval(timerId);
  }, [status, maxChain]);

  const isCurrentRound = roundSeed !== null && game.seed === roundSeed && game.status !== "READY";

  const { pairCount, board, score, chains, lastNuisance } = game;
  useEffect(() => {
    if (!iAmAlive || !isCurrentRound || pairCount === 0 || sentPairCountRef.current === pairCount) return;
    sentPairCountRef.current = pairCount;
    send({ type: "PUYO_BOARD", board: toBoardText(board), score, lines: chains });
    if (lastNuisance > 0) send({ type: "PUYO_ATTACK", cleared: lastNuisance });
  }, [iAmAlive, isCurrentRound, pairCount, board, score, chains, lastNuisance, send]);

  useEffect(() => {
    if (status !== "GAME_OVER" || !iAmAlive || !isCurrentRound || roundSeed === null || toppedOutSeedRef.current === roundSeed) return;
    toppedOutSeedRef.current = roundSeed;
    send({ type: "PUYO_BOARD", board: toBoardText(board), score, lines: chains });
    send({ type: "PUYO_TOPPED_OUT" });
  }, [status, iAmAlive, isCurrentRound, roundSeed, board, score, chains, send]);

  const garbageSequence = incomingPuyoGarbage?.sequence ?? 0;
  const [garbageWarning, setGarbageWarning] = useState<{ count: number; atPair: number } | null>(null);
  useEffect(() => {
    if (!incomingPuyoGarbage || garbageSequence === appliedGarbageRef.current) return;
    appliedGarbageRef.current = garbageSequence;
    dispatch({ type: "ADD_GARBAGE", count: incomingPuyoGarbage.count });
    setGarbageWarning({ count: incomingPuyoGarbage.count, atPair: pairCount });
  }, [garbageSequence, incomingPuyoGarbage, pairCount]);
  const warningCount = garbageWarning && garbageWarning.atPair === pairCount ? garbageWarning.count : game.pendingNuisance;

  const press = (action: PuyoAction) => {
    dispatch(action);
    stageRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = onlineKeyActions[event.key];
    if (!action) return;
    if (event.target !== event.currentTarget && event.key === " ") return;
    event.preventDefault();
    if (event.repeat && action.type === "HARD_DROP") return;
    dispatch(action);
  };

  const canControl = iAmAlive && connected && status === "PLAYING";
  const nicknameOf = (participantId: string | null) => room.participants.find((participant) => participant.participantId === participantId)?.nickname ?? null;
  const hostSeat = room.seats.findIndex((participantId) => participantId !== null && participantId === room.hostId);
  const slots: PlayerSlot[] = room.seats.map((participantId, seatIndex) => {
    const player = puyo?.players[seatIndex] ?? null;
    return { seatIndex, nickname: player?.nickname ?? nicknameOf(participantId), player };
  });
  const otherSlots = slots.filter((slot) => slot.seatIndex !== mySeat);

  const others = (
    <section className={`tetris-arena-others${mySeat === null ? " spectator" : ""}`} aria-label={mySeat === null ? "플레이어 판" : "다른 플레이어 판"}>
      {otherSlots.map((slot) => <OpponentCard key={slot.seatIndex} slot={slot} isHost={slot.seatIndex === hostSeat} />)}
    </section>
  );

  if (mySeat === null) {
    return (
      <div className="online-tetris">
        {!puyo ? <p className="online-hint">플레이어가 모두 앉고 방장이 시작하면 판이 움직입니다. 같은 순서의 쌍으로 겨루고, 연쇄가 나면 상대에게 방해 뿌요를 보냅니다.</p> : null}
        {others}
      </div>
    );
  }

  const displayBoard = createDisplayBoard(game);
  return (
    <div className="online-tetris">
      <div className="tetris-arena">
        <section className="tetris-arena-me" aria-label="내 판">
          <div className="tetris-nameplate me">
            <strong>{nicknameOf(room.myParticipantId) ?? "나"}</strong>
            {mySeat === hostSeat ? <span className="tetris-host-mark">방장</span> : null}
            <span>{score.toLocaleString("ko-KR")}점 · {chains}연쇄 · {colorCount}색</span>
          </div>
          <div
            ref={stageRef}
            className="tetris-arena-stage puyo-arena-stage"
            role="application"
            tabIndex={0}
            aria-label="뿌요뿌요 대전 내 판. ←→ 이동, ↓ 내리기, ↑·X 회전, Z 반대 회전, Space 바로 떨어뜨리기"
            onKeyDown={handleKeyDown}
          >
            <div className="tetris-arena-column">
              <span className="tetris-arena-label">NEXT</span>
              {game.queue.slice(0, PREVIEW_COUNT).map((pair, index) => (
                <div key={`${index}-${pair.axis}${pair.child}`} className={`tetris-arena-slot${index === 0 ? " large" : ""}`}>
                  <PuyoPreview pair={pair} />
                </div>
              ))}
            </div>
            <div className="puyo-board-wrap">
              <div className="puyo-board" role="img" aria-label={`내 판, 점수 ${score}점, ${chains}연쇄`}>
                {displayBoard.map((row, rowIndex) => row.map((cell, colIndex) => (
                  <span key={`${rowIndex}-${colIndex}`} className={cell ? `puyo-cell puyo-${cell.color.toLowerCase()}${cell.kind === "GHOST" ? " ghost" : ""}` : "puyo-cell"} />
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
            <div className="tetris-garbage-meter" role="meter" aria-label="받은 방해 뿌요" aria-valuemin={0} aria-valuemax={30} aria-valuenow={warningCount}>
              <span style={{ height: `${Math.min(100, (warningCount / 30) * 100)}%` }} />
            </div>
          </div>
          {incomingPuyoGarbage && canControl && warningCount > 0 ? <p key={garbageSequence} className="online-tetris-attack" role="status">{incomingPuyoGarbage.fromNickname}님이 방해 뿌요 {incomingPuyoGarbage.count}개를 보냈습니다!</p> : null}
          <div className="puyo-touch-controls online" role="group" aria-label="뿌요뿌요 조작 버튼">
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
      <p className="online-hint">같은 색 4개가 이어지면 터지고, 연쇄가 날수록 방해 뿌요가 다음 상대에게 갑니다. 받은 회색 뿌요는 색 뿌요가 터질 때 같이 사라집니다.</p>
    </div>
  );
};
