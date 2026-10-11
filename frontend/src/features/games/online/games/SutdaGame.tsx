/**
 * SutdaGame.tsx — 섯다 대전 화면(2~4명, 두 장 섯다)
 *
 * 내 패 두 장은 나에게만 온다. 남의 패는 끝까지 간 판에서만(지난 판 결과로) 공개된다.
 * 족보 계산·특수 패(암행어사·땡잡이·구사)·판돈 정산은 모두 서버가 한다.
 */
import { BettingControls } from "@/features/games/online/games/BettingControls";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { describeHwatu, sutdaSchema } from "@/features/games/online/games/sutdaRules";

const HwatuCard = ({ code }: { code?: string | null }) => {
  if (!code) return <span className="hwatu-card back" role="img" aria-label="뒷면 화투" />;
  const card = describeHwatu(code);
  return (
    <span className={`hwatu-card kind-${card.kind.toLowerCase()}`} role="img" aria-label={card.name}>
      <strong aria-hidden="true">{card.month}</strong>
      {card.kindLabel ? <small aria-hidden="true">{card.kindLabel}</small> : null}
    </span>
  );
};

export const SutdaGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const parsed = sutdaSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">모두 앉고 방장이 시작하면 각자 가상 칩 1000개로 6판을 합니다. 판마다 10칩을 내고 화투 두 장을 받아, 체크·콜·레이즈·다이로 베팅한 뒤 높은 족보가 판돈을 가져갑니다.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && game.phase === "BETTING";
  const myTurn = playing && connected && game.turnSeat === mySeat;
  const last = game.lastRound;

  return (
    <div className="sutda">
      <div className="sutda-players">
        {game.chips.map((chips, seat) => (
          <section key={seat} className={`sutda-player${game.turnSeat === seat ? " turn" : ""}${game.inHand[seat] ? "" : " folded"}${game.active[seat] ? "" : " out"}`} aria-label={`${nameAt(seat)} 자리`}>
            <h3>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}{seat === game.dealerSeat ? <small> 선</small> : null}</h3>
            <span className="sutda-chips">{chips.toLocaleString("ko-KR")}칩</span>
            <span className="online-hint">{!game.active[seat] ? "빠짐" : !game.inHand[seat] ? "다이" : game.contributed[seat] ? `이번 베팅 ${game.contributed[seat]}` : ""}</span>
            {seat !== mySeat && game.inHand[seat] && playing ? <span className="sutda-cards"><HwatuCard /><HwatuCard /></span> : null}
          </section>
        ))}
      </div>

      <div className="sutda-table">
        <span className="sutda-pot">판돈 {game.pot.toLocaleString("ko-KR")}칩</span>
        <span>{game.round}/{game.maxRounds}판{game.currentBet ? ` · 현재 베팅 ${game.currentBet}` : ""}</span>
      </div>

      <p className="game-status" aria-live="polite">
        {room.status !== "PLAYING" || game.phase === "FINISHED" ? room.lastResult ?? "게임 끝"
          : `${nameAt(game.turnSeat ?? 0)} 차례${myTurn ? " — 베팅하세요" : ""}`}
      </p>

      {mySeat !== null && game.myCards.length > 0 ? (
        <section className="sutda-hand" aria-label="내 패">
          <h3>내 패</h3>
          <span className="sutda-cards">{game.myCards.map((code) => <HwatuCard key={code} code={code} />)}</span>
        </section>
      ) : null}

      {myTurn ? (
        <BettingControls toCall={game.toCall} minRaise={game.minRaise} maxRaise={game.maxRaise} disabled={!connected} foldLabel="다이"
          onAct={(action, amount) => send({ type: "GAME_ACTION", action, number: amount })} />
      ) : null}

      {last ? (
        <section className="sutda-last" aria-label="지난 판">
          <h3>지난 판 {last.replay ? "— 구사로 다시" : `— ${last.winners.map(nameAt).join(" · ")} 승리 (+${last.pot}칩)`}</h3>
          <div className="sutda-last-hands">
            {last.cards.map((cards, seat) => (cards.length === 0 ? null : (
              <div key={seat} className={last.winners.includes(seat) ? "winner" : ""}>
                <strong>{nameAt(seat)}</strong>
                <span className="sutda-cards">{cards.map((code) => <HwatuCard key={code} code={code} />)}</span>
                <span>{last.handNames[seat]}</span>
              </div>
            )))}
            {last.cards.every((cards) => cards.length === 0) ? <p className="online-hint">모두 다이해 패를 공개하지 않았습니다.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};
