/**
 * SutdaGame.tsx — 섯다 대전 화면(2~4명, 2장 섯다·3장 섯다)
 *
 * 내 패는 나에게만 온다. 남의 패는 끝까지 간 판에서만(지난 판 결과로) 공개된다.
 * 족보 계산·특수 패(암행어사·땡잡이·구사)·판돈 정산은 모두 서버가 한다.
 *
 * [화면 구성]
 *   왼쪽: 전체 족보표(예시 화투 그림 포함). 서버가 알려 준 "지금 내 족보"(myHandName)가 있는 줄을 강조한다.
 *   오른쪽: 자리·판돈·내 패·베팅 버튼·지난 판.
 *   3장 섯다에서 세 번째 패를 받으면, 서버가 보내 준 세 가지 조합(myCombos) 중 보여 줄 두 장을 고른다(CHOOSE).
 */
import { BettingControls } from "@/features/games/online/games/BettingControls";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { describeHwatu, findJokboRow, HWATU_CREDIT, jokboRows, sutdaSchema } from "@/features/games/online/games/sutdaRules";

const HwatuCard = ({ code, small = false }: { code?: string | null; small?: boolean }) => {
  if (!code) return <span className={`hwatu-card back${small ? " small" : ""}`} role="img" aria-label="뒷면 화투" />;
  const card = describeHwatu(code);
  // alt에 카드 이름을 넣어 그림이 안 보이는 사람(화면 낭독기)도 같은 정보를 얻는다
  return <img className={`hwatu-card${small ? " small" : ""}`} src={card.imageUrl} alt={card.name} loading="lazy" draggable={false} />;
};

/** 왼쪽 족보표. highlightIndex = 지금 내 족보가 있는 줄 */
const JokboTable = ({ highlightIndex }: { highlightIndex: number }) => (
  <aside className="sutda-jokbo" aria-label="섯다 족보">
    <h3>족보 <small>위가 높음</small></h3>
    <ol>
      {jokboRows.map((row, index) => (
        <li key={row.title} className={`${row.special ? "special" : ""}${index === highlightIndex ? " mine" : ""}`}
          aria-current={index === highlightIndex ? "true" : undefined}>
          <span className="sutda-jokbo-cards">
            <HwatuCard code={row.example[0]} small />
            <HwatuCard code={row.example[1]} small />
          </span>
          <span className="sutda-jokbo-text">
            <strong>{row.title}{index === highlightIndex ? " ← 내 패" : ""}</strong>
            <small>{row.description}</small>
          </span>
        </li>
      ))}
    </ol>
    <p className="sutda-credit">
      화투 그림: {HWATU_CREDIT.author}, <a href={HWATU_CREDIT.licenseUrl} target="_blank" rel="noreferrer">{HWATU_CREDIT.license}</a>
      {" "}(<a href={HWATU_CREDIT.sourceUrl} target="_blank" rel="noreferrer">위키미디어 공용</a>)
    </p>
  </aside>
);

export const SutdaGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const parsed = sutdaSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return (
      <div className="sutda-layout">
        <JokboTable highlightIndex={-1} />
        <p className="online-hint">모두 앉고 방장이 시작하면 각자 가상 칩 1000개로 6판을 합니다. 판마다 10칩을 내고 화투를 받아, 체크·콜·레이즈·다이로 베팅한 뒤 높은 족보가 판돈을 가져갑니다. 방 옵션으로 2장 섯다·3장 섯다(세 장 중 두 장을 골라 보여 주기)를 고를 수 있습니다.</p>
      </div>
    );
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && game.phase !== "FINISHED";
  const betting = playing && game.phase === "BETTING";
  const choosing = playing && game.phase === "CHOOSE";
  const myTurn = betting && connected && game.turnSeat === mySeat;
  const canChoose = choosing && connected && mySeat != null && game.inHand[mySeat] === true;
  const last = game.lastRound;
  const myChosenKey = game.myChosen?.join(",") ?? "";

  const status = room.status !== "PLAYING" || game.phase === "FINISHED" ? room.lastResult ?? "게임 끝"
    : choosing ? (canChoose ? (game.myChosen ? "골랐습니다. 다른 사람을 기다리는 중…" : "보여 줄 두 장을 고르세요.") : "다른 사람이 두 장을 고르는 중…")
    : `${nameAt(game.turnSeat ?? 0)} 차례${myTurn ? " — 베팅하세요" : ""}`;

  return (
    <div className="sutda-layout">
      <JokboTable highlightIndex={findJokboRow(game.myHandName)} />
      <div className="sutda">
        <div className="sutda-players">
          {game.chips.map((chips, seat) => (
            <section key={seat} className={`sutda-player${game.turnSeat === seat && betting ? " turn" : ""}${game.inHand[seat] ? "" : " folded"}${game.active[seat] ? "" : " out"}`} aria-label={`${nameAt(seat)} 자리`}>
              <h3>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}{seat === game.dealerSeat ? <small> 선</small> : null}</h3>
              <span className="sutda-chips">{chips.toLocaleString("ko-KR")}칩</span>
              <span className="online-hint">
                {!game.active[seat] ? "빠짐" : !game.inHand[seat] ? "다이"
                  : choosing ? (game.chosen[seat] ? "두 장 고름" : "고르는 중")
                  : game.contributed[seat] ? `이번 베팅 ${game.contributed[seat]}` : ""}
              </span>
              {seat !== mySeat && game.inHand[seat] && playing ? (
                <span className="sutda-cards">
                  {/* 3장 섯다에서 세 번째 패를 받은 뒤에는 뒷면도 세 장(장수는 서버가 알려 준다) */}
                  {Array.from({ length: game.cardCounts[seat] ?? 2 }, (_, index) => <HwatuCard key={index} small />)}
                </span>
              ) : null}
            </section>
          ))}
        </div>

        <div className="sutda-table">
          <span className="sutda-pot">판돈 {game.pot.toLocaleString("ko-KR")}칩</span>
          <span>{game.mode === "THREE" ? "3장 섯다" : "2장 섯다"} · {game.round}/{game.maxRounds}판{game.currentBet ? ` · 현재 베팅 ${game.currentBet}` : ""}</span>
        </div>

        <p className="game-status" aria-live="polite">{status}</p>

        {mySeat !== null && game.myCards.length > 0 ? (
          <section className="sutda-hand" aria-label="내 패">
            <h3>내 패{game.myHandName ? <span className="sutda-my-jokbo"> · 지금 족보: <strong>{game.myHandName}</strong></span> : null}</h3>
            <span className="sutda-cards">
              {game.myCards.map((code, index) => (
                <span key={code} className={game.myChosen && !game.myChosen.includes(index) ? "sutda-discarded" : ""}>
                  <HwatuCard code={code} />
                </span>
              ))}
            </span>
          </section>
        ) : null}

        {canChoose && game.myCombos.length > 0 ? (
          <section className="sutda-choose" aria-label="보여 줄 두 장 고르기">
            {game.myCombos.map((combo) => {
              const key = combo.cards.join(",");
              const cardNames = combo.cards.map((index) => describeHwatu(game.myCards[index] ?? "1B").name).join(" + ");
              return (
                <button key={key} type="button" className={myChosenKey === key ? "" : "secondary-button"} aria-pressed={myChosenKey === key}
                  onClick={() => send({ type: "GAME_ACTION", action: "CHOOSE", numbers: combo.cards })}>
                  <strong>{combo.name}</strong> <small>{cardNames}</small>
                </button>
              );
            })}
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
                  <span className="sutda-cards">{cards.map((code) => <HwatuCard key={code} code={code} small />)}</span>
                  <span>{last.handNames[seat]}</span>
                </div>
              )))}
              {last.cards.every((cards) => cards.length === 0) ? <p className="online-hint">모두 다이해 패를 공개하지 않았습니다.</p> : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};
