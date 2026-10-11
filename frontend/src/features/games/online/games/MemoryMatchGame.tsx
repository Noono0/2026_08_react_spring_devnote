/**
 * MemoryMatchGame.tsx — 카드 짝 맞추기 대전 화면(2~4명)
 *
 * 혼자 하기(게임 → 카드 짝 맞추기)와 같은 카드 모양(memory-card CSS)을 쓴다. 다른 점:
 *   - 카드를 섞고 맞았는지 판단하는 일은 서버가 한다. 뒷면 카드의 그림은 서버가 보내지 않는다.
 *   - 내 차례에만 카드를 누를 수 있다. 맞히면 한 번 더, 틀리면 다음 사람 차례.
 *   - 맞춘 카드에는 맞춘 사람 색 테두리를 붙인다.
 */
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { memoryMatchSchema } from "@/features/games/online/games/memoryMatchRules";

export const MemoryMatchGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const parsed = memoryMatchSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">모두 앉고 방장이 시작하면, 한 판의 카드를 돌아가며 두 장씩 뒤집습니다. 같은 그림이면 내 짝이 되고 한 번 더! 가장 많이 맞힌 사람이 이깁니다.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && !game.finished;
  const myTurn = playing && connected && game.turnSeat === mySeat;
  const totalPairs = game.cards.length / 2;
  const matchedPairs = game.scores.reduce((total, score) => total + score, 0);

  return (
    <div className="memory-match">
      <div className="memory-match-players">
        {game.scores.map((score, seat) => (
          <div key={seat} className={`memory-match-player seat-${seat}${game.turnSeat === seat ? " turn" : ""}${game.active[seat] ? "" : " out"}${game.winners.includes(seat) ? " winner" : ""}`}>
            <strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
            <span>{score}쌍{game.active[seat] ? "" : " · 빠짐"}{game.winners.includes(seat) ? " · 승리" : ""}</span>
          </div>
        ))}
      </div>
      <p className="game-status" aria-live="polite">
        {game.finished ? room.lastResult ?? "게임 끝"
          : `${nameAt(game.turnSeat ?? 0)} 차례${myTurn ? " — 카드 두 장을 뒤집으세요!" : ""} · 남은 짝 ${totalPairs - matchedPairs}`}
      </p>
      <div className="memory-board" style={{ gridTemplateColumns: `repeat(${game.columns}, minmax(0, 1fr))`, maxWidth: game.columns * 96 }} aria-label="카드판">
        {game.cards.map((card, index) => {
          const shown = card.symbol != null;
          const canFlip = myTurn && card.matchedBy == null && !(card.faceUp && shown);
          return (
            <button
              key={index}
              type="button"
              className={`memory-card${shown ? " face-up" : ""}${card.matchedBy != null ? ` matched by-seat-${card.matchedBy}` : ""}`}
              aria-label={shown ? `${index + 1}번 카드 ${card.symbol ?? ""}${card.matchedBy != null ? ` (${nameAt(card.matchedBy)} 짝)` : ""}` : `${index + 1}번 카드 (뒷면)`}
              disabled={!canFlip}
              onClick={() => send({ type: "GAME_ACTION", action: "FLIP", number: index })}
            >
              <span className="memory-card-inner" aria-hidden="true">
                <span className="memory-card-back">?</span>
                <span className="memory-card-front">{card.symbol ?? ""}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
