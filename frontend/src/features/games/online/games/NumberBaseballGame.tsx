/**
 * NumberBaseballGame.tsx — 숫자 야구 대전 화면
 *
 * 비밀 숫자는 서버가 "나에게만" 보낸다(mySecret). 남의 숫자는 게임이 끝나야 secrets로 공개된다.
 * 화면은 입력이 규칙(서로 다른 숫자 3개)에 맞는지만 먼저 확인하고, 판정(S·B)은 서버가 한다.
 */
import { useState, type FormEvent } from "react";
import { isValidBaseballNumber, numberBaseballSchema } from "@/features/games/online/games/numberBaseballRules";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";

const describePitch = (strikes: number, balls: number) => (strikes === 0 && balls === 0 ? "OUT" : [strikes ? `${strikes}S` : "", balls ? `${balls}B` : ""].filter(Boolean).join(" "));

export const NumberBaseballGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const parsed = numberBaseballSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;

  if (!parsed.success) {
    return <p className="online-hint">플레이어가 모두 앉고 방장이 시작하면, 각자 비밀 숫자 3개를 정하고 돌아가며 다음 사람의 숫자를 맞힙니다. 숫자·자리가 맞으면 S, 숫자만 맞으면 B입니다.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING";
  const amActive = mySeat !== null && game.active[mySeat] === true;
  const mustSetSecret = playing && game.phase === "SETUP" && amActive && !game.mySecret;
  const myTurn = playing && game.phase === "PLAY" && game.turnSeat === mySeat;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidBaseballNumber(input)) {
      setInputError("서로 다른 숫자 3개(0~9)를 입력해 주세요.");
      return;
    }
    const sent = send({ type: "GAME_ACTION", action: mustSetSecret ? "SET_SECRET" : "GUESS", text: input });
    if (sent) {
      setInput("");
      setInputError(null);
    }
  };

  return (
    <div className="baseball">
      <div className="baseball-players">
        {game.active.map((active, seat) => (
          <div key={seat} className={`baseball-player${game.turnSeat === seat ? " turn" : ""}${active ? "" : " out"}${game.winners.includes(seat) ? " winner" : ""}`}>
            <strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
            <span>
              {game.secrets?.[seat] ? `숫자 ${game.secrets[seat]}`
                : !active ? "빠짐"
                  : game.phase === "SETUP" ? (game.secretReady[seat] ? "준비 완료" : "숫자 정하는 중")
                    : game.turnSeat === seat ? `${nameAt(game.targetSeat ?? seat)}의 숫자를 맞히는 중` : "대기"}
            </span>
            {game.winners.includes(seat) ? <span className="baseball-badge">승리</span> : null}
          </div>
        ))}
      </div>

      {game.mySecret ? <p className="baseball-secret">내 비밀 숫자: <strong>{game.mySecret}</strong></p> : null}
      <p className="game-status" aria-live="polite">
        {game.phase === "SETUP" ? "모두 비밀 숫자를 정하면 시작합니다."
          : game.phase === "PLAY" ? `${game.round}바퀴 · ${nameAt(game.turnSeat ?? 0)} 차례 → ${nameAt(game.targetSeat ?? 0)}의 숫자를 맞혀요${myTurn ? " — 내 차례!" : ""}`
            : room.lastResult ?? "게임 끝"}
      </p>

      {mustSetSecret || myTurn ? (
        <form className="baseball-form" onSubmit={submit}>
          <label htmlFor="baseball-input">{mustSetSecret ? "내 비밀 숫자 (서로 다른 숫자 3개)" : `${nameAt(game.targetSeat ?? 0)}의 숫자 맞히기`}</label>
          <div className="baseball-form-row">
            <input
              id="baseball-input"
              value={input}
              inputMode="numeric"
              maxLength={3}
              autoComplete="off"
              autoFocus
              aria-invalid={inputError ? true : undefined}
              onChange={(event) => setInput(event.target.value.replace(/[^0-9]/g, ""))}
            />
            <button type="submit" disabled={!connected || input.length !== 3}>{mustSetSecret ? "숫자 정하기" : "던지기"}</button>
          </div>
          {inputError ? <small className="field-error" role="alert">{inputError}</small> : null}
        </form>
      ) : null}

      <table className="baseball-history">
        <caption>기록</caption>
        <thead><tr><th scope="col">바퀴</th><th scope="col">누가 → 누구</th><th scope="col">추측</th><th scope="col">결과</th></tr></thead>
        <tbody>
          {game.history.length === 0 ? <tr><td colSpan={4} className="online-empty">아직 기록이 없습니다.</td></tr> : null}
          {[...game.history].reverse().map((pitch, index) => (
            <tr key={`${game.history.length - index}`} className={pitch.strikes === 3 ? "hit" : ""}>
              <td>{pitch.round}</td>
              <td>{nameAt(pitch.seat)} → {nameAt(pitch.targetSeat)}</td>
              <td className="baseball-guess">{pitch.guess}</td>
              <td>{describePitch(pitch.strikes, pitch.balls)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
