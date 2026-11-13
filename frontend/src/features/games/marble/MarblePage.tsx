import { useEffect, useReducer, useState } from "react";
import { Link } from "react-router-dom";
import { createMarbleGame, MARBLE_ROUNDS, marbleComputerAction, marbleReducer } from "./marbleLogic";
import "@/features/games/shared/games.css";
import { MarbleBoardView } from "./MarbleBoardView";
import "./marble.css";

function MarbleRun({ computers, seed }: { computers: number; seed: number }) {
  const [game, dispatch] = useReducer(marbleReducer, { computers, seed }, (input) => createMarbleGame(input.computers, input.seed));
  const current = game.players[game.turn];
  useEffect(() => {
    if (game.phase === "OVER" || (!current?.computer && !current?.bankrupt)) return;
    const timer = window.setTimeout(() => dispatch(marbleComputerAction(game)), 650);
    return () => window.clearTimeout(timer);
  }, [game, current?.computer, current?.bankrupt]);
  return <MarbleBoardView game={game} mySeat={0} onAction={dispatch} />;
}

export function MarblePractice() {
  const [computers, setComputers] = useState(2);
  const [run, setRun] = useState<{ computers: number; seed: number; version: number }>();
  return <div className="marble-page">
    <section className="game-panel"><div className="game-toolbar"><label htmlFor="marble-computers">컴퓨터 수</label><select id="marble-computers" value={computers} onChange={(event) => { const count = Number(event.target.value); if (count === 1 || count === 2 || count === 3) setComputers(count); }}>
      <option value={1}>1명 · 총 2명</option><option value={2}>2명 · 총 3명</option><option value={3}>3명 · 총 4명</option></select>
      <button type="button" onClick={() => setRun((previous) => ({ computers, seed: Math.floor(Math.random() * 0x1_0000_0000), version: (previous?.version ?? 0) + 1 }))}>{run ? "새 게임 시작" : "게임 시작"}</button></div>
      <details><summary>게임 규칙</summary><ul><li>학습용 간소화 규칙입니다. 현금 150만원으로 시작하며 출발을 통과하면 30만원을 받습니다.</li><li>빈 땅은 매입하고, 자기 땅에 다시 도착하면 최대 3단계까지 개발합니다. 통행료는 기본 금액 × (개발 단계 + 1)입니다.</li><li>행운 카드·세금·휴양지 보너스·무인도가 있습니다. 무인도에서는 다음 한 차례를 쉽니다.</li><li>현금이 모자라면 땅을 반값에 자동 매각하고, 그래도 납부하지 못하면 파산합니다.</li><li>마지막 생존자가 승리합니다. {MARBLE_ROUNDS}라운드가 끝나면 현금과 땅·개발 가치를 합산하며 동점이면 공동 승리합니다.</li><li>현재 판은 이 화면에서 진행되며 새 게임을 시작하거나 화면을 떠나면 초기화됩니다.</li></ul></details>
    </section>
    {run ? <MarbleRun key={run.version} computers={run.computers} seed={run.seed} /> : <div className="game-panel"><p>컴퓨터 수를 고르고 게임 시작을 누르세요. 내 차례에만 주사위와 매입·개발 버튼을 사용할 수 있습니다.</p></div>}
  </div>;
}

export function MarblePage() {
  return <section className="site-page marble-page"><div className="page-hero"><span className="page-kicker">City Marble</span><h1>부루마블</h1><p>컴퓨터와 도시를 사고 개발하며 자산을 늘려보세요.</p><Link to="/games">게임 홈으로</Link> · <Link to="/games/online">온라인 대전</Link></div><MarblePractice /></section>;
}
