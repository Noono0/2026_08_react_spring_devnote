import { marbleBattleSchema } from "./marbleBattleRules";
import { MarbleBoardView } from "@/features/games/marble/MarbleBoardView";
import { DeadlineTimer } from "./DeadlineTimer";
import type { CommonGameProperties } from "./CommonGameArea";


export function MarbleBattle({ room, mySeat, connected, send }: CommonGameProperties) {
  const parsed = marbleBattleSchema.safeParse(room.game);
  if (!parsed.success) return <p className="online-hint">부루마블은 2~4명이 같은 보드에서 겨룹니다. 주사위·자산·통행료는 서버가 계산합니다. 차례마다 60초가 지나면 자동 진행합니다.</p>;
  const game = parsed.data;
  return <div>{game.phase !== "OVER" ? <DeadlineTimer deadline={game.deadline} urgentSeconds={15} /> : null}
    {!connected ? <p role="status">연결이 끊겨 조작할 수 없습니다.</p> : mySeat === null ? <p>관전 중입니다.</p> : null}
    <MarbleBoardView game={game} mySeat={mySeat} connected={connected && room.status === "PLAYING"} onAction={(action) => {
      if (!connected || room.status !== "PLAYING" || mySeat === null || mySeat !== game.turn || game.players[mySeat]?.bankrupt) return;
      if (action.type === "SELL") send({ type: "GAME_ACTION", action: "SELL", number: action.tile });
      else send({ type: "GAME_ACTION", action: action.type });
    }} /></div>;
}
