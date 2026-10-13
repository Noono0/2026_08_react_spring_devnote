/**
 * BlackjackGame.tsx — 블랙잭 대전 화면(1~4명 vs 딜러)
 *
 * 위: 딜러(두 번째 카드는 딜러 차례 전까지 뒷면 — 서버가 보내지 않는다) · 아래: 플레이어 자리들 · 맨 아래: 내 조작
 * 칩은 게임 안에서만 쓰는 가상 점수다. 계산(점수·정산)은 모두 서버가 한다.
 */
import { useState } from "react";
import { BLACKJACK_BET_CHOICES, BLACKJACK_MIN_BET, blackjackSchema } from "@/features/games/online/games/blackjackRules";
import { CardFace } from "@/features/games/online/games/CardFace";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";

export const BlackjackGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [betAmount, setBetAmount] = useState(100);
  const parsed = blackjackSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">모두 앉고 방장이 시작하면 각자 1000칩(가상)으로 딜러와 5판을 겨룹니다. 21에 가깝게 받되 넘으면 버스트! 블랙잭은 1.5배.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && game.phase !== "FINISHED";
  const myChips = mySeat !== null ? game.chips[mySeat] ?? 0 : 0;
  const amActive = mySeat !== null && game.active[mySeat] === true;
  const canBet = playing && game.phase === "BETTING" && amActive && mySeat !== null && game.bets[mySeat] === 0;
  const myTurn = playing && connected && game.phase === "PLAYING" && game.turnSeat === mySeat;
  const myHand = mySeat !== null ? game.hands[mySeat] ?? [] : [];
  const canDouble = myTurn && myHand.length === 2 && mySeat !== null && (game.bets[mySeat] ?? 0) * 2 <= myChips;
  const act = (action: string, number?: number) => send({ type: "GAME_ACTION", action, number });
  const showLast = game.phase !== "PLAYING" && game.lastResults.length > 0;
  const dealerCards = game.phase === "PLAYING" ? game.dealerCards : game.lastDealerCards;
  const clampedBet = Math.max(BLACKJACK_MIN_BET, Math.min(betAmount, myChips));

  return (
    <div className="blackjack">
      <section className="blackjack-dealer" aria-label="딜러">
        <h3>딜러 {game.phase === "PLAYING" && game.dealerValue != null ? <small>{game.dealerHidden ? `${game.dealerValue} + ?` : game.dealerValue}</small> : null}{showLast ? <small>지난 판</small> : null}</h3>
        <div className="blackjack-cards">
          {dealerCards.length === 0 ? <span className="online-hint">베팅을 기다립니다</span> : dealerCards.map((card, index) => <CardFace key={index} code={card?.code ?? null} />)}
        </div>
      </section>

      <p className="game-status" aria-live="polite">
        {game.phase === "FINISHED" ? room.lastResult ?? "게임 끝"
          : game.phase === "BETTING" ? `${game.round}/${game.maxRounds}판 — 베팅하세요 (${game.bets.filter((bet, seat) => bet > 0 || !game.active[seat]).length}/${game.bets.length}명 완료)`
            : `${game.round}/${game.maxRounds}판 — ${nameAt(game.turnSeat ?? 0)} 차례${myTurn ? " · 받기·멈추기를 고르세요" : ""}`}
      </p>

      <div className="blackjack-players">
        {game.chips.map((chips, seat) => {
          const result = showLast ? game.lastResults[seat] : undefined;
          return (
            <section key={seat} className={`blackjack-player${game.turnSeat === seat ? " turn" : ""}${game.active[seat] ? "" : " out"}${game.winners.includes(seat) ? " winner" : ""}`} aria-label={`${nameAt(seat)} 자리`}>
              <h3>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</h3>
              <span className="blackjack-chips">{chips.toLocaleString("ko-KR")}칩{game.bets[seat] ? ` · 베팅 ${game.bets[seat]}` : ""}</span>
              {game.phase === "PLAYING" ? (
                <>
                  <div className="blackjack-cards small">{(game.hands[seat] ?? []).map((card) => <CardFace key={card.id} code={card.code} />)}</div>
                  <span className={`blackjack-value${(game.handValues[seat] ?? 0) > 21 ? " bust" : ""}`}>{game.handValues[seat]}{game.done[seat] ? " · 끝" : ""}</span>
                </>
              ) : null}
              {result ? <span className={`blackjack-result${result.delta > 0 ? " win" : result.delta < 0 ? " lose" : ""}`}>{result.outcome} {result.delta > 0 ? `+${result.delta}` : result.delta < 0 ? result.delta : "±0"}</span> : null}
            </section>
          );
        })}
      </div>

      {canBet ? (
        <div className="blackjack-controls" role="group" aria-label="베팅">
          {BLACKJACK_BET_CHOICES.filter((choice) => choice <= myChips).map((choice) => (
            <button key={choice} type="button" className={choice === clampedBet ? "" : "ghost-button"} aria-pressed={choice === clampedBet} onClick={() => setBetAmount(choice)}>{choice}</button>
          ))}
          <button type="button" className="ghost-button" onClick={() => setBetAmount(myChips)}>올인 {myChips}</button>
          <button type="button" disabled={!connected} onClick={() => act("BET", clampedBet)}>{clampedBet}칩 걸기</button>
        </div>
      ) : null}
      {myTurn ? (
        <div className="blackjack-controls" role="group" aria-label="내 차례">
          <button type="button" onClick={() => act("HIT")}>받기 (HIT)</button>
          <button type="button" className="ghost-button" onClick={() => act("STAND")}>멈추기 (STAND)</button>
          <button type="button" className="ghost-button" disabled={!canDouble} onClick={() => act("DOUBLE")}>더블 (베팅 2배 · 한 장)</button>
        </div>
      ) : null}
    </div>
  );
};
