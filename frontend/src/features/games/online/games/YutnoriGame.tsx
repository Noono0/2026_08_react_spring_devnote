/**
 * YutnoriGame.tsx — 윷놀이 화면(2~4명)
 *
 * 윷 던지기(난수)·길 계산·잡기·승패 판단은 모두 서버가 한다. 화면은 받은 상태를 그리고 버튼만 보낸다.
 *   - 내 차례(THROW)에는 "윷 던지기" 버튼, 결과가 모이면(MOVE) 서버가 보내 준 이동 목록을 버튼으로 보여 준다.
 *   - 이동 버튼에 마우스를 올리거나 Tab으로 가면 판에서 출발 칸과 도착 칸이 강조된다.
 *   - 판은 SVG로 그린다. 칸 위치는 yutnoriRules.ts의 boardPoint가 0~100 비율 좌표로 알려 준다.
 *
 * [학습 포인트]
 *   useState로 "지금 미리 보는 이동"(previewMove)을 들고 있다가 판 그리기에 쓴다.
 *   서버 상태(room.game)와 화면 전용 상태(미리 보기)를 나누어 두는 연습이다.
 */
import { useState } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import {
  boardNodes, boardPoint, FINISHED_NODE, isCornerNode, nodeLabel, pieceStacks, playerColors, throwLabels,
  WAITING_NODE, yutnoriSchema, type YutnoriMove,
} from "@/features/games/online/games/yutnoriRules";

/** 판의 선(바깥 사각형 + 대각선 두 개) */
const boardLines = [
  { x1: 10, y1: 10, x2: 90, y2: 10 }, { x1: 90, y1: 10, x2: 90, y2: 90 },
  { x1: 90, y1: 90, x2: 10, y2: 90 }, { x1: 10, y1: 90, x2: 10, y2: 10 },
  { x1: 90, y1: 10, x2: 10, y2: 90 }, { x1: 10, y1: 10, x2: 90, y2: 90 },
];

export const YutnoriGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [previewMove, setPreviewMove] = useState<YutnoriMove | null>(null);
  const parsed = yutnoriSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">2~4명이 앉고 방장이 시작하면 차례대로 윷을 던집니다. 윷·모가 나오거나 상대 말을 잡으면 한 번 더! 말을 모두 먼저 내보내면 이깁니다.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && !game.finished && connected;
  const myTurn = playing && mySeat === game.turnSeat;
  const myPieces = mySeat != null ? game.pieces[mySeat] ?? [] : [];

  // ★ 미리 보기는 "지금도 고를 수 있는 이동"일 때만 쓴다. 서버 상태가 바뀌어 사라진 이동을 계속 강조하지 않게 한다.
  const activePreview = previewMove && game.moves.some((move) => move.piece === previewMove.piece && move.throwIndex === previewMove.throwIndex)
    ? previewMove : null;
  const previewFrom = activePreview ? myPieces[activePreview.piece] : undefined;

  const moveLabel = (move: YutnoriMove) => {
    const throwName = throwLabels[game.pendingThrows[move.throwIndex] ?? "DO"];
    const from = myPieces[move.piece] ?? WAITING_NODE;
    const stacked = from === WAITING_NODE ? 1 : myPieces.filter((node) => node === from).length;
    const pieceText = from === WAITING_NODE ? "새 말" : `${nodeLabel(from)} 말${stacked > 1 ? `(${stacked}개 업힘)` : ""}`;
    return `${throwName}: ${pieceText} → ${nodeLabel(move.destination)}`;
  };
  const sendMove = (move: YutnoriMove) => {
    setPreviewMove(null);
    send({ type: "GAME_ACTION", action: "MOVE", numbers: [move.piece, move.throwIndex] });
  };

  const status = game.finished
    ? `${game.winnerSeat != null ? nameAt(game.winnerSeat) : ""} 승리!`
    : myTurn ? (game.phase === "THROW" ? "내 차례입니다. 윷을 던지세요." : "옮길 말을 고르세요.")
    : `${nameAt(game.turnSeat)} 님 차례 (${game.phase === "THROW" ? "던지는 중" : "말 옮기는 중"})`;

  return (
    <div className="yutnori">
      <p className="game-status" aria-live="polite">{status}</p>

      <ul className="yutnori-players" aria-label="플레이어">
        {game.pieces.map((seatPieces, seat) => {
          const waiting = seatPieces.filter((node) => node === WAITING_NODE).length;
          const finished = seatPieces.filter((node) => node === FINISHED_NODE).length;
          return (
            <li key={seat} className={`${seat === game.turnSeat && !game.finished ? "turn" : ""}${game.active[seat] === false ? " left" : ""}`}>
              <span className="yutnori-token" style={{ background: playerColors[seat] }} aria-hidden="true" />
              <strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
              <span>{game.active[seat] === false ? "나감" : `대기 ${waiting} · 났음 ${finished}/${seatPieces.length}`}</span>
            </li>
          );
        })}
      </ul>

      <svg className="yutnori-board" viewBox="0 0 100 100" role="img" aria-label="윷판">
        {boardLines.map((line, index) => <line key={index} {...line} className="yutnori-line" />)}
        <text x={90} y={98.5} textAnchor="middle" className="yutnori-start-label">출발·도착</text>
        {boardNodes.map((node) => {
          const point = boardPoint(node);
          if (!point) return null;
          const highlighted = activePreview && (node === activePreview.destination || node === previewFrom);
          return (
            <circle key={node} cx={point.x} cy={point.y} r={isCornerNode(node) ? 4.2 : 2.8}
              className={`yutnori-node${highlighted ? " highlighted" : ""}`} />
          );
        })}
        {pieceStacks(game.pieces).map(({ seat, node, count }) => {
          const point = boardPoint(node);
          if (!point) return null;
          // 여러 사람이 같은 칸에 있을 수는 없다(잡히므로). 자리마다 살짝 비켜 그려 겹침만 막는다.
          return (
            <g key={`${seat}-${node}`} transform={`translate(${point.x} ${point.y})`}>
              <circle r={3.4} fill={playerColors[seat]} className="yutnori-piece" />
              {count > 1 && <text className="yutnori-piece-count" textAnchor="middle" dy="1.3">{count}</text>}
            </g>
          );
        })}
      </svg>

      {game.pendingThrows.length > 0 && (
        <p className="yutnori-throws" aria-label="나온 윷 결과">
          {game.pendingThrows.map((result, index) => <span key={index} className="yutnori-throw">{throwLabels[result]}</span>)}
        </p>
      )}

      {myTurn && game.phase === "THROW" && (
        <button type="button" onClick={() => send({ type: "GAME_ACTION", action: "THROW" })}>윷 던지기</button>
      )}

      {myTurn && game.moves.length > 0 && (
        <ul className="yutnori-moves" aria-label="옮길 수 있는 말">
          {game.moves.map((move) => (
            <li key={`${move.piece}-${move.throwIndex}`}>
              <button type="button" className="secondary-button"
                onMouseEnter={() => setPreviewMove(move)} onFocus={() => setPreviewMove(move)}
                onMouseLeave={() => setPreviewMove(null)} onBlur={() => setPreviewMove(null)}
                onClick={() => sendMove(move)}>
                {moveLabel(move)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {game.log.length > 0 && (
        <ol className="yutnori-log" aria-label="진행 기록">
          {game.log.slice(-8).map((entry, index) => <li key={index}>{entry}</li>)}
        </ol>
      )}
    </div>
  );
};
