/**
 * ChessGame.tsx — 체스 대전 화면(2명, 0번 자리 = 백)
 *
 * 규칙 판단(합법수·체크메이트·캐슬링·앙파상·프로모션)은 모두 서버가 한다.
 * 화면은 서버가 보내 준 합법수 목록(legalMoves)으로 "어디로 갈 수 있는지"만 표시한다.
 *   1) 내 기물을 누르면 선택 → 갈 수 있는 칸에 점이 찍힌다.
 *   2) 점 찍힌 칸을 누르면 MOVE를 보낸다. 폰이 끝 줄에 닿으면 바꿀 기물을 먼저 고른다.
 *   - 흑은 판을 뒤집어 내 기물이 아래에 오도록 그린다.
 */
import { useState } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { chessSchema, pieceName, pieceSymbol, promotionChoices, squareName } from "@/features/games/online/games/chessRules";

type Square = { row: number; col: number };

export const ChessGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const parsed = chessSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">두 명이 앉고 방장이 시작하면 0번 자리가 백(먼저), 1번 자리가 흑입니다. 내 기물을 누른 뒤 점이 찍힌 칸을 누르면 둡니다.</p>;
  }
  const game = parsed.data;
  const myTurn = room.status === "PLAYING" && !game.finished && connected && game.turnSeat === mySeat;
  const flipped = game.myColor === "BLACK";
  const order = [0, 1, 2, 3, 4, 5, 6, 7];
  const rows = flipped ? [...order].reverse() : order;
  const cols = flipped ? [...order].reverse() : order;
  const movesFrom = (square: Square) => game.legalMoves.filter((move) => move[0] === square.row && move[1] === square.col);
  const targets = selected && myTurn ? movesFrom(selected) : [];
  const isTarget = (row: number, col: number) => targets.some((move) => move[2] === row && move[3] === col);
  const isLast = (row: number, col: number) => game.lastMove != null
    && ((game.lastMove[0] === row && game.lastMove[1] === col) || (game.lastMove[2] === row && game.lastMove[3] === col));
  const turnIsWhite = game.turnSeat === 0;

  const sendMove = (from: Square, to: Square, piece?: string) => {
    send({ type: "GAME_ACTION", action: "MOVE", numbers: [from.row, from.col, to.row, to.col], ...(piece ? { text: piece } : {}) });
    setSelected(null);
    setPromotion(null);
  };

  const clickSquare = (row: number, col: number) => {
    if (!myTurn) return;
    if (selected && isTarget(row, col)) {
      const piece = game.board[selected.row]?.[selected.col] ?? ".";
      const promoting = piece.toUpperCase() === "P" && (row === 0 || row === 7);
      if (promoting) setPromotion({ from: selected, to: { row, col } });
      else sendMove(selected, { row, col });
      return;
    }
    setPromotion(null);
    setSelected(movesFrom({ row, col }).length > 0 ? { row, col } : null);
  };

  const playerLine = (seat: number) => (
    <div className={`chess-player${game.turnSeat === seat ? " turn" : ""}${game.winnerSeat === seat ? " winner" : ""}`}>
      <strong>{seat === 0 ? "백" : "흑"} · {nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
      <span className="chess-captured" aria-label={`${nameAt(seat)}가 잡은 기물`}>
        {(seat === 0 ? game.capturedByWhite : game.capturedByBlack).map(pieceSymbol).join(" ") || "잡은 기물 없음"}
      </span>
    </div>
  );

  return (
    <div className="chess">
      {playerLine(flipped ? 0 : 1)}
      <p className="game-status" aria-live="polite">
        {game.finished ? room.lastResult ?? game.result ?? "게임 끝"
          : `${turnIsWhite ? "백" : "흑"}(${nameAt(game.turnSeat ?? 0)}) 차례${game.inCheck ? " — 체크!" : ""}${myTurn ? " · 내 기물을 고르세요" : ""}`}
      </p>
      <div className="chess-board" role="grid" aria-label="체스판">
        {rows.map((row) => (
          <div key={row} role="row" className="chess-row">
            {cols.map((col) => {
              const piece = game.board[row]?.[col] ?? ".";
              const dark = (row + col) % 2 === 1;
              const isSelected = selected?.row === row && selected.col === col;
              const target = isTarget(row, col);
              const label = `${squareName(row, col)}${piece === "." ? "" : ` ${pieceName(piece)}`}${target ? " (이동 가능)" : ""}`;
              return (
                <button
                  key={col}
                  type="button"
                  role="gridcell"
                  className={`chess-square${dark ? " dark" : ""}${isSelected ? " selected" : ""}${target ? " target" : ""}${isLast(row, col) ? " last" : ""}${piece === "." ? "" : piece === piece.toUpperCase() ? " white-piece" : " black-piece"}`}
                  aria-label={label}
                  aria-pressed={isSelected}
                  disabled={!myTurn}
                  onClick={() => clickSquare(row, col)}
                >
                  <span aria-hidden="true">{piece === "." ? "" : pieceSymbol(piece)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {promotion && (
        <div className="chess-promotion" role="group" aria-label="프로모션 기물 고르기">
          <span>폰을 무엇으로 바꿀까요?</span>
          {promotionChoices.map((choice) => (
            <button key={choice.piece} type="button" className="secondary-button" onClick={() => sendMove(promotion.from, promotion.to, choice.piece)}>
              {choice.label}
            </button>
          ))}
        </div>
      )}
      {playerLine(flipped ? 1 : 0)}
      {game.history.length > 0 && (
        <ol className="chess-history" aria-label="기보">
          {game.history.map((entry, index) => <li key={index}>{entry}</li>)}
        </ol>
      )}
    </div>
  );
};
