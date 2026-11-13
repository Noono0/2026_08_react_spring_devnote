import { mazeBattleSchema } from "./mazeBattleRules";
import { MazeBoardView } from "@/features/games/maze/MazeBoardView";
import type { Maze } from "@/features/games/maze/mazeLogic";
import { DeadlineTimer } from "./DeadlineTimer";
import type { CommonGameProperties } from "./CommonGameArea";


export function MazeBattle({ room, mySeat, connected, send }: CommonGameProperties) {
  const parsed = mazeBattleSchema.safeParse(room.game);
  if (!parsed.success) return <p className="online-hint">미로 대전은 2~4명이 같은 미로를 각자 풀어 먼저 탈출하면 승리합니다. 난이도를 정하고 시작하세요. 제한 시간은 5분입니다.</p>;
  const game = parsed.data;
  const maze: Maze = { size: game.size, walls: game.walls.map((row) => Array.from(row, (cell) => cell === "1")), start: game.start, exit: game.exit };
  const playing = connected && room.status === "PLAYING" && !game.finished && mySeat !== null && game.active[mySeat] === true;
  const nameAt = (seat: number) => room.participants.find((person) => person.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  const position = mySeat === null ? game.start : game.positions[mySeat] ?? game.start;
  return <section className="maze-run"><div className="game-toolbar"><h3>같은 미로 먼저 탈출하기</h3>{!game.finished ? <DeadlineTimer deadline={game.deadline} urgentSeconds={20} /> : null}</div>
    <p role="status">{game.finished ? game.winnerSeats.length ? `${game.winnerSeats.map(nameAt).join(", ")} 승리!` : "시간 종료 · 무승부" : !connected ? "연결이 끊겨 조작할 수 없습니다." : mySeat === null ? "관전 중입니다." : "화살표·WASD·화면 버튼으로 출구에 도착하세요. 대전에서는 길 안내를 제공하지 않습니다."}</p>
    <ul className="marble-players" aria-label="미로 대전 현황">{game.moves.map((moves, seat) => <li key={seat} className="game-panel"><strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong><span>{moves}칸 이동{game.active[seat] ? "" : " · 기권"}</span></li>)}</ul>
    <MazeBoardView maze={maze} position={position} disabled={!playing} onMove={(direction) => { if (playing) send({ type: "GAME_ACTION", action: "MOVE", text: direction }); }} />
  </section>;
}
