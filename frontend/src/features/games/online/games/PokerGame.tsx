/**
 * PokerGame.tsx — 포커(텍사스 홀덤) 대전 화면(2~4명)
 *
 * 가운데 테이블: 공용 카드(플랍 3·턴 1·리버 1)와 팟 · 둘레: 플레이어(칩·이번 베팅·딜러 버튼) · 아래: 내 카드와 베팅 버튼
 * 족보 계산·승부·팟 나누기는 서버가 한다. 남의 카드는 끝까지 간 판에서만 지난 판 결과로 공개된다.
 */
import { BettingControls } from "@/features/games/online/games/BettingControls";
import { CardFace } from "@/features/games/online/games/CardFace";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { pokerSchema } from "@/features/games/online/games/pokerRules";

export const PokerGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const parsed = pokerSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">모두 앉고 방장이 시작하면 가상 칩 1000개로 텍사스 홀덤 6판을 합니다. 내 카드 2장과 공용 카드 5장 중 가장 좋은 5장으로 겨룹니다(블라인드 10/20).</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && game.phase === "BETTING";
  const myTurn = playing && connected && game.turnSeat === mySeat;
  const last = game.lastHand;
  const boardSlots = [...game.board.map((card) => card.code), ...Array.from({ length: 5 - game.board.length }, () => null)];

  return (
    <div className="poker">
      <div className="poker-players">
        {game.chips.map((chips, seat) => (
          <section key={seat} className={`poker-player${game.turnSeat === seat ? " turn" : ""}${game.inHand[seat] ? "" : " folded"}${game.active[seat] ? "" : " out"}`} aria-label={`${nameAt(seat)} 자리`}>
            <h3>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}{seat === game.dealerSeat ? <span className="poker-dealer" aria-label="딜러">D</span> : null}</h3>
            <span className="poker-chips">{chips.toLocaleString("ko-KR")}칩</span>
            <span className="online-hint">{!game.active[seat] ? "빠짐" : !game.inHand[seat] ? "폴드" : game.contributed[seat] ? `이번 베팅 ${game.contributed[seat]}` : ""}</span>
            {seat !== mySeat && game.inHand[seat] && playing ? <span className="poker-hole"><CardFace small /><CardFace small /></span> : null}
          </section>
        ))}
      </div>

      <div className="poker-table" aria-label="공용 카드">
        <span className="poker-street">{game.handNumber}/{game.maxHands}판 · {game.street}</span>
        <div className="poker-board">{boardSlots.map((code, index) => (code ? <CardFace key={index} code={code} /> : <span key={index} className="poker-slot" aria-hidden="true" />))}</div>
        <span className="poker-pot">팟 {game.pot.toLocaleString("ko-KR")}칩{game.currentBet ? ` · 현재 베팅 ${game.currentBet}` : ""}</span>
      </div>

      <p className="game-status" aria-live="polite">
        {room.status !== "PLAYING" || game.phase === "FINISHED" ? room.lastResult ?? "게임 끝" : `${nameAt(game.turnSeat ?? 0)} 차례${myTurn ? " — 베팅하세요" : ""}`}
      </p>

      {mySeat !== null && game.myCards.length > 0 ? (
        <section className="poker-mine" aria-label="내 카드">
          <h3>내 카드</h3>
          <div className="poker-board">{game.myCards.map((card) => <CardFace key={card.id} code={card.code} />)}</div>
        </section>
      ) : null}

      {myTurn ? (
        <BettingControls toCall={game.toCall} minRaise={game.minRaise} maxRaise={game.maxRaise} disabled={!connected} foldLabel="폴드"
          onAct={(action, amount) => send({ type: "GAME_ACTION", action, number: amount })} />
      ) : null}

      {last ? (
        <section className="poker-last" aria-label="지난 판">
          <h3>지난 판 — {last.winners.map(nameAt).join(" · ")} 승리 (+{last.pot}칩)</h3>
          {last.board.length > 0 ? <div className="poker-board small">{last.board.map((card) => <CardFace key={card.id} code={card.code} small />)}</div> : null}
          <div className="poker-last-hands">
            {last.cards.map((cards, seat) => (cards.length === 0 ? null : (
              <div key={seat} className={last.winners.includes(seat) ? "winner" : ""}>
                <strong>{nameAt(seat)}</strong>
                <span className="poker-hole">{cards.map((card) => <CardFace key={card.id} code={card.code} small />)}</span>
                <span>{last.handNames[seat]}</span>
              </div>
            )))}
            {last.cards.every((cards) => cards.length === 0) ? <p className="online-hint">모두 폴드해 카드를 공개하지 않았습니다.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};
