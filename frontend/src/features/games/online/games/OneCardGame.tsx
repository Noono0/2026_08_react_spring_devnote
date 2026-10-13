/**
 * OneCardGame.tsx — 원카드 대전 화면(2~4명)
 *
 * 위: 다른 사람(카드 장수만 — 패는 서버가 보내지 않는다) · 가운데: 맨 위 카드·무늬·공격·순서 · 아래: 내 패
 * 낼 수 있는 카드만 밝게 보이고(화면이 미리 계산), 7을 내면 바꿀 무늬를 고른다.
 */
import { useState } from "react";
import { CardFace } from "@/features/games/online/games/CardFace";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { canPlayCard, oneCardSchema } from "@/features/games/online/games/oneCardRules";
import { parseCard, SUIT_NAMES, SUIT_SYMBOLS } from "@/features/games/online/games/playingCards";

export const OneCardGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [pendingSeven, setPendingSeven] = useState<number | null>(null); // 무늬를 고르는 중인 7의 카드 번호
  const parsed = oneCardSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">모두 앉고 방장이 시작하면 7장씩 받습니다. 맨 위 카드와 무늬나 숫자가 같은 카드를 내고, 먼저 다 내면 이깁니다. A·2·조커는 공격, 7은 무늬 바꾸기, J 건너뛰기, Q 거꾸로, K 한 번 더.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && !game.finished;
  const myTurn = playing && connected && game.turnSeat === mySeat;
  const act = (action: string, extra: { number?: number; text?: string } = {}) => send({ type: "GAME_ACTION", action, ...extra });

  const playCard = (cardId: number, code: string) => {
    if (parseCard(code).rank === 7) {
      setPendingSeven(cardId);
      return;
    }
    act("PLAY", { number: cardId });
  };

  const suitText = game.anyCard ? "아무 카드" : game.currentSuit ? `${SUIT_SYMBOLS[game.currentSuit] ?? ""} ${SUIT_NAMES[game.currentSuit] ?? ""}` : "";

  return (
    <div className="one-card">
      <div className="one-card-opponents">
        {game.handCounts.map((count, seat) => (seat === mySeat ? null : (
          <div key={seat} className={`one-card-opponent${game.turnSeat === seat ? " turn" : ""}${game.active[seat] ? "" : " out"}`}>
            <strong>{nameAt(seat)}</strong>
            <span className="one-card-backs" aria-hidden="true">{Array.from({ length: Math.min(count, 10) }, (_, index) => <CardFace key={index} small />)}</span>
            <span>{game.ranks[seat] ? `${game.ranks[seat]}위` : `${count}장`}</span>
          </div>
        )))}
      </div>

      <div className="one-card-table">
        <div className="one-card-pile">
          <span className="online-hint">더미 {game.drawPileCount}장</span>
          <CardFace />
        </div>
        <div className="one-card-top">
          <CardFace code={game.top.code} />
          <span className="one-card-suit">{suitText}</span>
        </div>
        <div className="one-card-info">
          {game.attackPenalty > 0 ? <span className="one-card-attack">공격 +{game.attackPenalty}</span> : null}
          <span>순서 {game.direction === 1 ? "→ 정방향" : "← 거꾸로"}</span>
        </div>
      </div>

      <p className="game-status" aria-live="polite">
        {game.finished ? room.lastResult ?? "게임 끝"
          : `${nameAt(game.turnSeat ?? 0)} 차례${myTurn ? (game.attackPenalty > 0 ? ` — A·2·조커로 막거나 ${game.attackPenalty}장 받기` : " — 낼 카드를 고르세요") : ""}`}
      </p>

      {mySeat !== null ? (
        <section className="one-card-hand" aria-label="내 패">
          <h3>내 패 <small>{game.myHand.length}장{game.ranks[mySeat] ? ` · ${game.ranks[mySeat]}위` : ""}</small></h3>
          <div className="one-card-hand-cards">
            {game.myHand.map((card) => {
              const playable = myTurn && canPlayCard(card.code, game);
              return (
                <button key={card.id} type="button" className={`one-card-card${playable ? " playable" : ""}`} disabled={!playable} aria-label={`${parseCard(card.code).name} 내기`} onClick={() => playCard(card.id, card.code)}>
                  <CardFace code={card.code} />
                </button>
              );
            })}
          </div>
          {pendingSeven !== null && myTurn ? (
            <div className="one-card-suit-picker" role="group" aria-label="바꿀 무늬 고르기">
              <span>바꿀 무늬:</span>
              {(["S", "H", "D", "C"] as const).map((suit) => (
                <button key={suit} type="button" className={`ghost-button${suit === "H" || suit === "D" ? " red" : ""}`} onClick={() => { act("PLAY", { number: pendingSeven, text: suit }); setPendingSeven(null); }}>
                  {SUIT_SYMBOLS[suit]} {SUIT_NAMES[suit]}
                </button>
              ))}
              <button type="button" className="ghost-button" onClick={() => setPendingSeven(null)}>취소</button>
            </div>
          ) : null}
          {myTurn ? (
            <button type="button" className={game.attackPenalty > 0 ? "danger-button" : "ghost-button"} onClick={() => act("DRAW")}>
              {game.attackPenalty > 0 ? `${game.attackPenalty}장 받기` : "한 장 받기"}
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};
