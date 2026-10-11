/**
 * Game2048Battle.tsx — 2048 대전 화면(2~4명)
 *
 * 모두 같은 처음 판에서 시작하고, 새 타일도 모두 같은 순서로 받는다(서버가 자리마다 같은 시드로 만든다).
 * 방장이 고른 목표 타일을 가장 적은 이동으로 만든 사람이 1위다.
 *   - 화면은 판을 직접 바꾸지 않는다. 방향을 GAME_ACTION(MOVE)으로 보내고, 서버가 보낸 판으로 다시 그린다.
 *   - 밀어도 판이 그대로인 방향은 혼자 하기 규칙 함수(moveBoard)로 미리 알아내 보내지 않는다(서버도 세지 않는다).
 *   - 조작: 판에 포커스를 두고 방향키·W·A·S·D, 화면 버튼, 판 위에서 밀기(Pointer 이벤트)
 *   - 배치: 테트리스 대전처럼 왼쪽에 내 큰 판, 오른쪽에 다른 사람의 작은 판(좁으면 위아래로)
 */
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { moveBoard, type Direction } from "@/features/games/game2048/game2048Logic";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import {
  directionLabels,
  game2048BattleSchema,
  keyDirections,
  tileClassName,
  type Game2048BattlePlayer,
  type Game2048BattleView,
} from "@/features/games/online/games/game2048BattleRules";
import { RaceNameplate } from "@/features/games/online/games/RaceNameplate";
import { raceStatusLabels } from "@/features/games/online/games/raceBattleRules";

/** 이만큼(px) 이상 밀어야 스와이프로 본다(혼자 하기와 같다) */
const SWIPE_THRESHOLD = 30;
const DIRECTION_ORDER: Direction[] = ["UP", "LEFT", "DOWN", "RIGHT"];
const DIRECTION_ARROWS: Record<Direction, string> = { UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→" };

const recordText = (player: Game2048BattlePlayer) => `${player.score.toLocaleString("ko-KR")}점 · ${player.moves}번`;

const describeMyState = (game: Game2048BattleView, me: Game2048BattlePlayer | undefined, lastResult: string | null | undefined): string => {
  if (game.finished) return lastResult ?? "게임 끝";
  if (!me) return "관전 중입니다. 모든 플레이어의 판이 보입니다.";
  switch (me.status) {
    case "SUCCESS": return `${game.target} 타일을 ${me.moves}번 만에 만들었습니다! 다른 사람이 끝날 때까지 기다립니다.`;
    case "FAILED": return `더 밀 수 없습니다(점수 ${me.score.toLocaleString("ko-KR")}점). 다른 사람이 끝날 때까지 기다립니다.`;
    case "LEFT": return "기권했습니다. 다른 사람이 끝날 때까지 지켜볼 수 있습니다.";
    default: return `${game.target} 타일을 가장 적은 이동으로 만들면 1위! 모두 같은 판·같은 새 타일로 겨룹니다.`;
  }
};

const MiniBoard = ({ player, seat, mySeat, winner }: { player: Game2048BattlePlayer; seat: number; mySeat: number | null; winner: boolean }) => (
  <figure className={`race-opponent${player.status === "PLAYING" ? "" : " done"}`}
    aria-label={`${player.nickname} 판, ${recordText(player)}, ${raceStatusLabels[player.status]}${player.rank != null ? `, ${player.rank}위` : ""}`}>
    <RaceNameplate nickname={player.nickname} isMe={seat === mySeat} status={player.status} rank={player.rank} winner={winner} record={recordText(player)} />
    <div className="race-mini-2048" aria-hidden="true">
      {player.board.flatMap((row, rowIndex) => row.map((value, colIndex) => (
        <span key={`${rowIndex}-${colIndex}`} className={`race-mini-tile ${tileClassName(value)}`}>{value === 0 ? "" : value}</span>
      )))}
    </div>
  </figure>
);

export const Game2048Battle = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  // 스와이프 시작 위치. 화면에 그릴 값이 아니라 ref에 둔다
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const parsed = game2048BattleSchema.safeParse(room.game);

  if (!parsed.success) {
    return <p className="online-hint">모두 앉고 방장이 시작하면 모두 같은 2048 판을 받습니다. 방장이 고른 목표 타일을 가장 적은 이동으로 만든 사람이 이기고, 다른 사람의 판도 실시간으로 보입니다.</p>;
  }
  const game = parsed.data;
  const me = mySeat === null ? undefined : game.players[mySeat];
  const canPlay = room.status === "PLAYING" && !game.finished && connected && me?.status === "PLAYING";

  const move = (direction: Direction) => {
    if (!canPlay || !me || !moveBoard(me.board, direction).moved) return;
    send({ type: "GAME_ACTION", action: "MOVE", text: direction });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = keyDirections[event.key];
    if (!direction) return;
    event.preventDefault(); // 방향키로 페이지가 스크롤되지 않게
    move(direction);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) move(deltaX > 0 ? "RIGHT" : "LEFT");
    else move(deltaY > 0 ? "DOWN" : "UP");
  };

  const others = game.players.map((player, seat) => ({ player, seat })).filter(({ seat }) => seat !== mySeat);
  const statusTone = me?.status === "SUCCESS" || game.finished ? " success" : me?.status === "FAILED" ? " danger" : "";

  return (
    <div className="race-battle">
      <p className={`game-status${statusTone}`} aria-live="polite">{describeMyState(game, me, room.lastResult)}</p>
      <div className={`race-arena${me ? "" : " spectator"}`}>
        {me && mySeat !== null ? (
          <section className="race-arena-me" aria-label="내 판">
            <RaceNameplate nickname={me.nickname} isMe status={me.status} rank={me.rank} winner={game.winners.includes(mySeat)} record={recordText(me)} />
            <div className="game-2048-stage">
              <div
                className="game-2048-board"
                role="grid"
                aria-label={`내 2048 판(목표 ${game.target}). 방향키 또는 W·A·S·D로 밉니다`}
                aria-disabled={!canPlay}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onPointerDown={(event) => { pointerStartRef.current = { x: event.clientX, y: event.clientY }; }}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { pointerStartRef.current = null; }}
              >
                {me.board.map((row, rowIndex) => (
                  <div key={rowIndex} className="game-2048-row" role="row">
                    {row.map((value, colIndex) => (
                      <div key={colIndex} role="gridcell" aria-label={value === 0 ? "빈칸" : String(value)} className={`game-2048-tile ${tileClassName(value)}`}>
                        {value === 0 ? "" : value}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="game-direction-pad" role="group" aria-label="방향 버튼">
              {DIRECTION_ORDER.map((direction) => (
                <button key={direction} type="button" className={`ghost-button direction-${direction.toLowerCase()}`}
                  aria-label={`${directionLabels[direction]}으로 밀기`} disabled={!canPlay} onClick={() => move(direction)}>
                  {DIRECTION_ARROWS[direction]}
                </button>
              ))}
            </div>
          </section>
        ) : null}
        <section className="race-arena-others" aria-label={me ? "다른 플레이어 판" : "플레이어 판"}>
          {others.map(({ player, seat }) => (
            <MiniBoard key={seat} player={player} seat={seat} mySeat={mySeat} winner={game.winners.includes(seat)} />
          ))}
        </section>
      </div>
    </div>
  );
};
