/**
 * AppleBattle.tsx — 사과게임 대전 화면(2~4명, 모두 같은 판을 각자 푼다)
 *
 * 사각형을 고르면 SELECT [줄1, 칸1, 줄2, 칸2]를 보낸다. 합이 10인지 판정하고 점수를 주는 것은 서버다.
 * 서버가 돌려준 "내 판"으로 다시 그리므로, 화면이 먼저 사과를 지우지 않는다(서버가 정답).
 * 다른 사람의 판은 보내지 않고 점수와 남은 사과 수만 보여 준다. 남은 시간은 DeadlineTimer.
 */
import { AppleBoardView } from "@/features/games/apple/AppleBoardView";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { appleBattleSchema, toAppleBoard } from "@/features/games/online/games/appleBattleRules";
import { DeadlineTimer } from "@/features/games/online/games/DeadlineTimer";

export const AppleBattle = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const parsed = appleBattleSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">2~4명이 앉고 방장이 시작하면 모두 같은 사과판(숫자 1~9)을 받습니다. 사각형으로 사과를 골라 합 10을 만들면 사과가 사라지고 개수만큼 점수! 2분 뒤 점수가 가장 높은 사람이 이깁니다.</p>;
  }
  const game = parsed.data;
  const board = toAppleBoard(game.myBoard);
  const playing = room.status === "PLAYING" && !game.finished && connected;
  const canPlay = playing && mySeat != null && game.active[mySeat] !== false && board !== null;

  return (
    <div className="apple-game">
      <div className="apple-stats">
        {!game.finished ? <DeadlineTimer deadline={game.deadline} urgentSeconds={15} /> : null}
        <p className="game-status" aria-live="polite">
          {game.finished
            ? (game.winnerSeats.length > 0 ? `${game.winnerSeats.map(nameAt).join(" · ")} 승리!` : "무승부!")
            : mySeat == null ? "관전 중입니다. 점수만 보입니다." : "합이 10이 되게 사과를 골라 없애세요!"}
        </p>
      </div>
      <ol className="apple-scoreboard" aria-label="점수">
        {game.scores.map((score, seat) => (
          <li key={seat} className={`${seat === mySeat ? "me" : ""}${game.active[seat] === false ? " left" : ""}${game.winnerSeats.includes(seat) ? " winner" : ""}`}>
            <strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
            <span>{score}개 · 남은 사과 {game.remaining[seat] ?? 0}{game.active[seat] === false ? " · 나감" : ""}</span>
          </li>
        ))}
      </ol>
      {board ? (
        <AppleBoardView board={board} disabled={!canPlay}
          onSelect={(rect) => send({ type: "GAME_ACTION", action: "SELECT", numbers: [rect.top, rect.left, rect.bottom, rect.right] })} />
      ) : null}
    </div>
  );
};
