/**
 * BattleshipGame.tsx — 배틀십 대전 화면(2명)
 *
 * 왼쪽에 내 함대(내 배·상대가 쏜 자리), 오른쪽에 상대 바다(내가 쏜 결과). 내 차례에 상대 바다를 누르면 쏜다.
 * 상대 배 위치는 서버가 보내지 않으므로(격침된 배만) 화면에서도 알 수 없다.
 * 관전자는 양쪽 바다를 쏜 결과만 본다.
 */
import { BATTLESHIP_CELL_LABELS, battleshipSchema } from "@/features/games/online/games/battleshipRules";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";

const COLUMN_NAMES = "ABCDEFGHIJ";

interface SeaProperties {
  title: string;
  rows: string[];
  shipsLeft: number;
  canFire: boolean;
  onFire?: (row: number, col: number) => void;
}

/** 10×10 바다. canFire이면 아직 안 쏜 칸을 누를 수 있다 */
const Sea = ({ title, rows, shipsLeft, canFire, onFire }: SeaProperties) => (
  <section className="battleship-sea" aria-label={title}>
    <h3>{title} <small>남은 배 {shipsLeft}척</small></h3>
    <div className={`battleship-grid${canFire ? " can-fire" : ""}`} role="group" aria-label={`${title} 10×10`}>
      {rows.map((row, rowIndex) => [...row].map((cell, colIndex) => {
        const target = canFire && (cell === "." || cell === "S");
        const label = `${COLUMN_NAMES[colIndex]}${rowIndex + 1} ${BATTLESHIP_CELL_LABELS[cell] ?? ""}`;
        return target && onFire ? (
          <button key={`${rowIndex}-${colIndex}`} type="button" className="battleship-cell" aria-label={`${label} — 쏘기`} onClick={() => onFire(rowIndex, colIndex)} />
        ) : (
          <span key={`${rowIndex}-${colIndex}`} className={`battleship-cell mark-${cell === "#" ? "sunk" : cell === "." ? "sea" : cell.toLowerCase()}`} aria-label={label} role="img" />
        );
      }))}
    </div>
  </section>
);

export const BattleshipGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const parsed = battleshipSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">두 사람이 앉고 방장이 시작하면 배 5척(5·4·3·3·2칸)을 배치하고, 번갈아 상대 바다를 쏴서 먼저 모두 격침하면 이깁니다.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING";
  // 플레이어 자리(0·1). 관전자는 null
  const playerSeat = mySeat === 0 || mySeat === 1 ? mySeat : null;
  const iAmReady = playerSeat !== null && game.ready[playerSeat] === true;
  const placing = playing && game.phase === "PLACE";
  const myTurn = playing && game.phase === "PLAY" && game.turnSeat === mySeat && connected;
  const act = (action: string, numbers?: number[]) => send({ type: "GAME_ACTION", action, numbers });

  const status = game.phase === "PLACE"
    ? (iAmReady ? "상대가 배치를 마치기를 기다립니다." : "배를 배치하는 중입니다. 마음에 들 때까지 다시 배치할 수 있습니다.")
    : game.phase === "PLAY" ? `${nameAt(game.turnSeat ?? 0)} 차례${myTurn ? " — 상대 바다를 눌러 쏘세요!" : ""}`
      : room.lastResult ?? "게임 끝";

  const mySeaIndex = playerSeat ?? 0;
  const otherSeaIndex = playerSeat === null ? 1 : 1 - playerSeat;
  const isPlayer = playerSeat !== null;
  const myBoard = game.boards[mySeaIndex];
  const otherBoard = game.boards[otherSeaIndex];

  return (
    <div className="battleship">
      <p className="game-status" aria-live="polite">{status}</p>
      {placing && isPlayer && !iAmReady ? (
        <div className="button-row">
          <button type="button" className="ghost-button" disabled={!connected} onClick={() => act("RANDOMIZE")}>다시 배치</button>
          <button type="button" disabled={!connected} onClick={() => act("READY")}>준비 완료</button>
        </div>
      ) : null}
      <div className="battleship-seas">
        {myBoard ? <Sea title={isPlayer ? "내 함대" : `${nameAt(mySeaIndex)}의 바다`} rows={myBoard.rows} shipsLeft={myBoard.shipsLeft} canFire={false} /> : null}
        {otherBoard ? (
          <Sea
            title={`${nameAt(otherSeaIndex)}의 바다`}
            rows={otherBoard.rows}
            shipsLeft={otherBoard.shipsLeft}
            canFire={myTurn}
            onFire={(row, col) => act("FIRE", [row, col])}
          />
        ) : null}
      </div>
      <p className="online-hint">o 빗나감 · X 명중 · 어두운 칸은 격침된 배. 배 길이: {game.shipLengths.join("·")}칸</p>
    </div>
  );
};
