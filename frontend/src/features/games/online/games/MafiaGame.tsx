/**
 * MafiaGame.tsx — 마피아 화면(4~8명)
 *
 * 직업 나누기·밤 결과·투표 집계·승패 판단은 모두 서버가 한다. 화면은 받은 상태로 버튼만 그린다.
 *   - 남의 직업은 서버가 보내지 않는다(마피아끼리만 서로 보임). 끝나면 모두 공개된다.
 *   - 밤: 직업이 있는 사람만 대상 버튼(지목·조사·살리기)이 보인다. 시민은 기다린다.
 *   - 낮: 채팅으로 이야기한 뒤, 살아 있는 사람이 모두 투표(또는 건너뛰기)하면 결과가 나온다.
 *   - 탈락하면 게임이 끝날 때까지 채팅을 보낼 수 없다(서버가 막는다).
 */
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { mafiaSchema, roleInfo, SKIP_VOTE } from "@/features/games/online/games/mafiaRules";

export const MafiaGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const parsed = mafiaSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">4~8명이 앉고 방장이 시작하면 서버가 직업(마피아·경찰·의사·시민)을 몰래 나눠 줍니다. 밤에는 직업별로 대상을 고르고, 낮에는 채팅으로 이야기한 뒤 투표로 마피아를 찾아내세요.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && !game.finished && connected;
  const me = mySeat != null ? game.players[mySeat] : undefined;
  const iAmAlive = me?.alive === true;
  const myRole = game.myRole ?? null;
  const nightButton = myRole ? roleInfo[myRole].nightButton : null;
  const canActAtNight = playing && iAmAlive && game.phase === "NIGHT" && nightButton != null;
  const canVote = playing && iAmAlive && game.phase === "DAY";

  const canPick = (seat: number) => {
    const player = game.players[seat];
    if (!player?.alive) return false;
    if (canVote) return seat !== mySeat;
    if (!canActAtNight) return false;
    if (myRole === "MAFIA") return player.role !== "MAFIA";
    if (myRole === "POLICE") return seat !== mySeat;
    return true;
  };
  const pick = (seat: number) => send({ type: "GAME_ACTION", action: game.phase === "DAY" ? "VOTE" : "TARGET", number: seat });

  const phaseText = game.finished ? `${game.winnerTeam ?? ""} 팀 승리!`
    : game.phase === "NIGHT" ? `${game.round}번째 밤 🌙` : `${game.round}번째 낮 ☀️`;
  const guide = game.finished ? "게임이 끝나 모든 직업이 공개되었습니다."
    : !iAmAlive && mySeat != null ? "탈락했습니다. 게임이 끝날 때까지 지켜봐 주세요(채팅 불가)."
    : mySeat == null ? "관전 중입니다. 직업은 게임이 끝나면 공개됩니다."
    : game.phase === "NIGHT" ? (nightButton ? `${nightButton}할 사람을 고르세요. 모두 고르면 아침이 됩니다.` : "시민은 밤에 할 일이 없습니다. 아침을 기다리세요.")
    : "채팅으로 이야기한 뒤 마피아로 의심되는 사람에게 투표하세요.";
  const votedCount = game.players.filter((player) => player.done).length;
  const aliveCount = game.players.filter((player) => player.alive).length;
  const mafiaPicks = Object.entries(game.mafiaChoices).filter(([seat]) => Number(seat) !== mySeat);

  return (
    <div className={`mafia ${game.phase === "NIGHT" ? "night" : "day"}`}>
      {myRole && (
        <section className={`mafia-role role-${myRole.toLowerCase()}`} aria-label="내 직업">
          <strong>나의 직업: {roleInfo[myRole].label}</strong>
          <span>{roleInfo[myRole].mission}</span>
        </section>
      )}
      <p className="game-status" aria-live="polite">
        {phaseText} · {guide}{game.phase === "DAY" && !game.finished ? ` (투표 ${votedCount}/${aliveCount})` : ""}
      </p>
      <ul className="mafia-players" aria-label="플레이어">
        {game.players.map((player, seat) => {
          const chosen = game.myChoice === seat;
          return (
            <li key={seat} className={`mafia-player${player.alive ? "" : " dead"}${chosen ? " chosen" : ""}`}>
              <strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
              <span>
                {player.alive ? "생존" : "탈락"}
                {player.role ? ` · ${roleInfo[player.role].label}` : ""}
                {player.done ? " · 투표 완료" : ""}
              </span>
              {canPick(seat) && (
                <button type="button" className={chosen ? "" : "secondary-button"} aria-pressed={chosen} onClick={() => pick(seat)}>
                  {canVote ? "투표" : nightButton}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {canVote && (
        <button type="button" className={game.myChoice === SKIP_VOTE ? "" : "secondary-button"} aria-pressed={game.myChoice === SKIP_VOTE}
          onClick={() => send({ type: "GAME_ACTION", action: "VOTE", number: SKIP_VOTE })}>
          투표 건너뛰기
        </button>
      )}
      {mafiaPicks.length > 0 && (
        <p className="mafia-secret">동료 마피아의 선택: {mafiaPicks.map(([seat, target]) => `${nameAt(Number(seat))} → ${nameAt(target)}`).join(", ")}</p>
      )}
      {game.investigations.length > 0 && (
        <section className="mafia-secret" aria-label="조사 결과">
          <strong>조사 결과</strong>
          <ul>
            {game.investigations.map((result, index) => (
              <li key={index}>{nameAt(result.seat)}: {result.mafia ? "마피아입니다!" : "마피아가 아닙니다"}</li>
            ))}
          </ul>
        </section>
      )}
      {game.log.length > 0 && (
        <ol className="mafia-log" aria-label="진행 기록">
          {game.log.map((entry, index) => <li key={index}>{entry}</li>)}
        </ol>
      )}
    </div>
  );
};
