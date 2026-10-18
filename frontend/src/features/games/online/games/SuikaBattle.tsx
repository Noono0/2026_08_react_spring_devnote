/**
 * SuikaBattle.tsx — 수박게임 대전 화면(2~4명, 각자 자기 상자)
 *
 * 서버가 준 시드(seed)로 난수를 만들어 모두 같은 순서의 과일을 받는다. 물리는 내 브라우저가 계산하고(SuikaBoard),
 * 점수가 바뀔 때마다 SCORE, 상자가 넘치면 OVER를 보낸다. 다른 사람은 점수와 끝났는지만 보인다. 3분 뒤 높은 점수가 이긴다.
 *
 * [시드 난수를 한 번만 만드는 이유] 렌더링마다 createSeededRandom(seed)를 새로 부르면 매번 첫 과일부터 다시 나온다.
 *   그래서 seed가 바뀔 때만 판(MySuikaBoard)을 새로 만들도록 key={seed}를 주고, 판 안에서 useState로 한 번만 만든다.
 */
import { useState } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { DeadlineTimer } from "@/features/games/online/games/DeadlineTimer";
import { suikaBattleSchema } from "@/features/games/online/games/suikaBattleRules";
import { createSeededRandom } from "@/features/games/shared/random";
import { SuikaBoard } from "@/features/games/suika/SuikaBoard";

interface MySuikaBoardProps {
  seed: number;
  disabled: boolean;
  serverScore: number;
  send: CommonGameProperties["send"];
}

const MySuikaBoard = ({ seed, disabled, serverScore, send }: MySuikaBoardProps) => {
  const [random] = useState(() => createSeededRandom(seed));
  return (
    <SuikaBoard random={random} disabled={disabled}
      // 서버가 이미 아는 점수면 다시 보내지 않는다(처음 0점 등)
      onScoreChange={(score) => { if (!disabled && score > serverScore) send({ type: "GAME_ACTION", action: "SCORE", number: score }); }}
      onGameOver={(score) => { if (!disabled) send({ type: "GAME_ACTION", action: "OVER", number: score }); }} />
  );
};

export const SuikaBattle = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const parsed = suikaBattleSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">2~4명이 앉고 방장이 시작하면 모두 같은 순서의 과일로 각자 수박게임을 합니다. 같은 과일을 합쳐 점수를 올리세요. 3분 뒤(또는 모두 상자가 넘치면) 점수가 가장 높은 사람이 이깁니다.</p>;
  }
  const game = parsed.data;
  const iAmPlayer = mySeat != null && mySeat < game.scores.length;
  const myOver = iAmPlayer && game.over[mySeat] === true;
  const canPlay = room.status === "PLAYING" && !game.finished && connected && iAmPlayer && !myOver && game.active[mySeat] !== false;

  return (
    <div className="suika-game">
      <div className="apple-stats">
        {!game.finished ? <DeadlineTimer deadline={game.deadline} urgentSeconds={20} /> : null}
        <p className="game-status" aria-live="polite">
          {game.finished
            ? (game.winnerSeats.length > 0 ? `${game.winnerSeats.map(nameAt).join(" · ")} 승리!` : "무승부!")
            : !iAmPlayer ? "관전 중입니다. 점수만 보입니다."
            : myOver ? "내 상자가 넘쳤어요. 다른 사람을 기다리는 중…" : "같은 과일을 합쳐 점수를 올리세요!"}
        </p>
      </div>
      <ol className="apple-scoreboard" aria-label="점수">
        {game.scores.map((score, seat) => (
          <li key={seat} className={`${seat === mySeat ? "me" : ""}${game.active[seat] === false ? " left" : ""}${game.winnerSeats.includes(seat) ? " winner" : ""}`}>
            <strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
            <span>{score}점{game.over[seat] ? " · 넘침" : ""}{game.active[seat] === false ? " · 나감" : ""}</span>
          </li>
        ))}
      </ol>
      {iAmPlayer ? <MySuikaBoard key={game.seed} seed={game.seed} disabled={!canPlay} serverScore={game.scores[mySeat] ?? 0} send={send} /> : null}
    </div>
  );
};
