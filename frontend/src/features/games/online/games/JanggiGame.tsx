/**
 * JanggiGame.tsx — 장기 대전 화면(2명, 0번 자리 = 초·먼저, 1번 자리 = 한)
 *
 * 1) 상차림: 시작하면 각자 마·상 위치 네 가지 중 하나를 고른다. 둘 다 고르면 대국이 시작된다.
 * 2) 대국: 내 기물을 누르면 서버가 보내 준 합법수(moves)로 갈 수 있는 점이 표시되고, 그 점을 누르면 MOVE를 보낸다.
 *    장군이 아닐 때는 "한 수 쉬기"(PASS)도 할 수 있다.
 *
 * [판 그리기]
 *   장기는 칸 안이 아니라 "선이 만나는 점"에 기물을 놓는다. 그래서 9×10 버튼 격자를 깔고,
 *   그 뒤에 SVG로 각 버튼 한가운데를 잇는 선(과 궁성 대각선)을 그린다. 버튼이 곧 교차점이다.
 *   한은 판을 180° 돌려 내 기물이 아래에 오도록 그린다(줄·칸 순서를 뒤집기만 하면 된다).
 */
import { useState } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import {
  formatScore, formations, isCho, JANGGI_COLS, JANGGI_ROWS, janggiSchema, palaceDiagonals, pieceHanja, pieceName, pointName,
} from "@/features/games/online/games/janggiRules";

type Point = { row: number; col: number };

const rowIndexes = Array.from({ length: JANGGI_ROWS }, (_, index) => index);
const colIndexes = Array.from({ length: JANGGI_COLS }, (_, index) => index);

export const JanggiGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [selected, setSelected] = useState<Point | null>(null);
  const parsed = janggiSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">두 명이 앉고 방장이 시작하면 0번 자리가 초(먼저), 1번 자리가 한입니다. 먼저 각자 마·상 위치(상차림)를 고른 뒤, 내 기물을 누르고 점이 찍힌 곳을 눌러 둡니다.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && !game.finished && connected;
  const myTurn = playing && game.phase === "PLAY" && game.turnSeat === mySeat;
  const flipped = mySeat === 1;
  const rows = flipped ? [...rowIndexes].reverse() : rowIndexes;
  const cols = flipped ? [...colIndexes].reverse() : colIndexes;
  const movesFrom = (point: Point) => game.moves.filter((move) => move.fromRow === point.row && move.fromCol === point.col);
  const targets = selected && myTurn ? movesFrom(selected) : [];
  const isTarget = (row: number, col: number) => targets.some((move) => move.toRow === row && move.toCol === col);
  const isLast = (row: number, col: number) => game.lastMove != null
    && ((game.lastMove.fromRow === row && game.lastMove.fromCol === col) || (game.lastMove.toRow === row && game.lastMove.toCol === col));
  const sideName = (seat: number) => (seat === 0 ? "초" : "한");

  const clickPoint = (row: number, col: number) => {
    if (!myTurn) return;
    if (selected && isTarget(row, col)) {
      send({ type: "GAME_ACTION", action: "MOVE", numbers: [selected.row, selected.col, row, col] });
      setSelected(null);
      return;
    }
    setSelected(movesFrom({ row, col }).length > 0 ? { row, col } : null);
  };

  const playerLine = (seat: number) => (
    <div className={`janggi-player side-${seat === 0 ? "cho" : "han"}${game.turnSeat === seat && game.phase === "PLAY" ? " turn" : ""}${game.winnerSeat === seat ? " winner" : ""}`}>
      <strong>{sideName(seat)} · {nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
      <span>{game.phase === "SETUP" ? (game.arranged[seat] ? "상차림 고름" : "상차림 고르는 중") : `${formatScore(game.scores[seat] ?? 0)}점${seat === 1 ? "(덤 1.5)" : ""}`}</span>
    </div>
  );

  const status = game.finished ? game.result ?? room.lastResult ?? "대국 끝"
    : game.phase === "SETUP" ? "마·상 위치(상차림)를 고르세요. 둘 다 고르면 초부터 둡니다."
    : `${sideName(game.turnSeat)}(${nameAt(game.turnSeat)}) 차례${game.inCheck ? " — 장군!" : ""}${game.bikjang ? " — 빅장! 이번 수에 풀지 않으면 점수로 끝나요" : ""}${myTurn ? " · 내 기물을 고르세요" : ""}`;

  return (
    <div className="janggi">
      {playerLine(flipped ? 0 : 1)}
      <p className="game-status" aria-live="polite">{status}</p>

      {game.phase === "SETUP" && mySeat != null && playing ? (
        <div className="janggi-setup" role="group" aria-label="상차림 고르기">
          {formations.map((formation) => (
            <button key={formation.code} type="button" className={game.myFormation === formation.code ? "" : "secondary-button"}
              aria-pressed={game.myFormation === formation.code}
              onClick={() => send({ type: "GAME_ACTION", action: "ARRANGE", text: formation.code })}>
              <strong>{formation.label}</strong> <small>{formation.description}</small>
            </button>
          ))}
        </div>
      ) : null}

      <div className="janggi-board">
        <svg className="janggi-lines" viewBox={`0 0 ${JANGGI_COLS} ${JANGGI_ROWS}`} aria-hidden="true" preserveAspectRatio="none">
          {rowIndexes.map((row) => <line key={`r${row}`} x1={0.5} y1={row + 0.5} x2={JANGGI_COLS - 0.5} y2={row + 0.5} />)}
          {colIndexes.map((col) => <line key={`c${col}`} x1={col + 0.5} y1={0.5} x2={col + 0.5} y2={JANGGI_ROWS - 0.5} />)}
          {/* 궁성 X자. 한 쪽에서 볼 때는 판 전체를 돌리므로 좌표를 뒤집는다 */}
          {palaceDiagonals.map((line, index) => {
            const flip = (value: number, size: number) => (flipped ? size - 1 - value : value) + 0.5;
            return <line key={index} x1={flip(line.x1, JANGGI_COLS)} y1={flip(line.y1, JANGGI_ROWS)} x2={flip(line.x2, JANGGI_COLS)} y2={flip(line.y2, JANGGI_ROWS)} />;
          })}
        </svg>
        <div className="janggi-points" role="grid" aria-label="장기판">
          {rows.map((row) => (
            <div key={row} role="row" className="janggi-row">
              {cols.map((col) => {
                const piece = game.board[row]?.[col] ?? ".";
                const isSelected = selected?.row === row && selected.col === col;
                const target = isTarget(row, col);
                const label = `${pointName(row, col)}${piece === "." ? "" : ` ${pieceName(piece)}`}${target ? " (이동 가능)" : ""}`;
                return (
                  <button key={col} type="button" role="gridcell" aria-label={label} aria-pressed={isSelected} disabled={!myTurn}
                    className={`janggi-point${isSelected ? " selected" : ""}${target ? " target" : ""}${isLast(row, col) ? " last" : ""}`}
                    onClick={() => clickPoint(row, col)}>
                    {piece === "." ? null : (
                      <span className={`janggi-piece ${isCho(piece) ? "cho" : "han"} type-${piece.toLowerCase()}`} aria-hidden="true">{pieceHanja(piece)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {myTurn && game.canPass ? (
        <button type="button" className="secondary-button" onClick={() => send({ type: "GAME_ACTION", action: "PASS" })}>한 수 쉬기</button>
      ) : null}
      {playerLine(flipped ? 1 : 0)}
      {game.log.length > 0 && (
        <ol className="janggi-log" aria-label="기보">
          {game.log.slice(-10).map((entry, index) => <li key={index}>{entry}</li>)}
        </ol>
      )}
    </div>
  );
};
