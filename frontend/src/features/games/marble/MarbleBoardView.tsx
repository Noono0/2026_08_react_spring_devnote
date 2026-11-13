import { MARBLE_ROUNDS, marbleAssets, marbleTiles, propertyRent, propertyValue, type MarbleAction, type MarbleState } from "./marbleLogic";
import "./marble.css";

export type MarbleGameView = Omit<MarbleState, "randomState">;
const boardPosition = (index: number) => {
  if (index <= 5) return { gridRow: 6, gridColumn: 6 - index };
  if (index <= 10) return { gridRow: 11 - index, gridColumn: 1 };
  if (index <= 15) return { gridRow: 1, gridColumn: index - 9 };
  return { gridRow: index - 14, gridColumn: 6 };
};

export function MarbleBoardView({ game, mySeat, connected = true, onAction }: { game: MarbleGameView; mySeat: number | null; connected?: boolean; onAction: (action: MarbleAction) => void }) {
  const current = game.players[game.turn];
  const tile = marbleTiles[current?.position ?? 0];
  const property = game.properties[current?.position ?? 0];
  const humanTurn = connected && mySeat !== null && game.turn === mySeat && game.phase !== "OVER" && !current?.bankrupt;
  return <div className="marble-run">
    <ul className="marble-players" aria-label="참가자 자산">{game.players.map((player, seat) => <li key={seat} className={`marble-player marble-color-${seat}${seat === game.turn ? " current" : ""}`}>
      <strong>{seat + 1}. {player.name}{player.bankrupt ? " · 파산" : ""}</strong><span>현금 {player.cash}만원</span><span>총자산 {marbleAssets(game, seat)}만원</span>
    </li>)}</ul>
    <div className="marble-board" role="region" aria-label="부루마블 게임판">
      {marbleTiles.map((square, index) => { const owned = game.properties[index]; return <div key={index} style={boardPosition(index)} className={`marble-tile ${square.kind.toLowerCase()}${owned?.owner !== null ? ` marble-owned-${owned?.owner}` : ""}`}>
        <strong>{square.name}</strong>{square.kind === "CITY" ? <small>{owned?.owner === null ? `${square.price}만원` : `${game.players[owned?.owner ?? -1]?.name} · ${owned?.level}단계`}</small> : null}
        {square.kind === "CITY" && owned?.owner !== null ? <small>통행료 {propertyRent(index, owned?.level ?? 0)}</small> : null}
        <div className="marble-tokens">{game.players.map((player, seat) => !player.bankrupt && player.position === index ? <span key={seat} className={`marble-token marble-color-${seat}`} aria-label={`${player.name} 현재 위치`}>{seat + 1}</span> : null)}</div>
      </div>; })}
      <div className="marble-center"><span className="page-kicker">CITY MARBLE</span><h2>부루마블</h2>
        <p>{Math.min(MARBLE_ROUNDS, Math.floor(game.turnsPlayed / game.players.length) + 1)} / {MARBLE_ROUNDS}라운드</p>
        <p className="marble-dice" aria-label={game.dice ? `주사위 ${game.dice[0]}, ${game.dice[1]}` : "주사위 대기"}>{game.dice ? game.dice.join(" · ") : "? · ?"}</p>
        <p role="status">{game.phase === "OVER" ? `${game.winners.map((seat) => game.players[seat]?.name).join(", ")} 승리!` : `${current?.name} 차례${current?.computer ? " · 생각 중..." : ""}`}</p>
        <p className="marble-location">현재 위치: {tile?.name}</p>
      </div>
    </div>
    <section className="game-panel" aria-label="부루마블 진행"><div className="marble-actions">
      <button type="button" disabled={!humanTurn || game.phase !== "ROLL"} onClick={() => onAction({ type: "ROLL", seat: mySeat ?? -1 })}>{current?.skip && humanTurn ? "무인도 한 차례 쉬기" : "주사위 굴리기"}</button>
      {humanTurn && game.phase === "DECIDE" && property?.owner === null ? <button type="button" disabled={(current?.cash ?? 0) < (tile?.price ?? 0)} onClick={() => onAction({ type: "BUY", seat: mySeat ?? -1 })}>땅 사기 · {tile?.price}만원</button> : null}
      {humanTurn && game.phase === "DECIDE" && property?.owner === mySeat ? <button type="button" disabled={(current?.cash ?? 0) < Math.floor((tile?.price ?? 0) / 2)} onClick={() => onAction({ type: "UPGRADE", seat: mySeat ?? -1 })}>개발하기 · {Math.floor((tile?.price ?? 0) / 2)}만원</button> : null}
      <button type="button" disabled={!humanTurn || (game.phase !== "DECIDE" && game.phase !== "END")} onClick={() => onAction({ type: "END", seat: mySeat ?? -1 })}>차례 마치기</button>
    </div><p className="game-status">{game.phase === "DECIDE" && humanTurn ? "매입·개발을 선택하거나 차례 마치기로 건너뛰세요." : game.phase === "OVER" ? "마지막 생존자 또는 총자산이 가장 많은 참가자가 승리합니다. 새 게임으로 다시 시작할 수 있습니다." : "주사위를 굴리고 도착한 칸의 처리가 끝나면 차례를 마칩니다."}</p>
      <h3>최근 진행</h3><ol className="marble-log" aria-label="최근 게임 기록">{game.log.map((line, index) => <li key={`${game.turnsPlayed}:${index}:${line}`}>{line}</li>)}</ol>
    </section>
    <details className="game-panel"><summary>내 땅 관리 · 반값 매각</summary><p>내 차례의 주사위 굴리기 전·처리 후에 매각할 수 있습니다. 납부금이 부족하면 땅을 반값에 자동 매각합니다.</p>
      <ul className="marble-property-list">{game.properties.flatMap((owned, index) => mySeat !== null && owned.owner === mySeat ? [<li key={index}><span>{marbleTiles[index]?.name} · {owned.level}단계 · 매각 {Math.floor(propertyValue(index, owned.level) / 2)}만원</span>
        <button type="button" disabled={!humanTurn || game.phase === "DECIDE"} onClick={() => onAction({ type: "SELL", seat: mySeat ?? -1, tile: index })}>{marbleTiles[index]?.name} 매각</button></li>] : [])}</ul>
      {mySeat === null || game.properties.every((owned) => owned.owner !== mySeat) ? <p>아직 소유한 땅이 없습니다.</p> : null}</details>
  </div>;
}
