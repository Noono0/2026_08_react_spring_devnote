/**
 * OlympicGame.tsx — 올림픽 대전 화면(1~4명)
 *
 * 흐름: 1번 선수가 종목 고르기(SELECT) → 종목마다 각자 경기(EVENT) → 순위·메달(RESULT) → … → 폐막(END)
 *   - 경기 움직임은 내 브라우저가 계산한다(OlympicEventPlay). 끝나면 기록만 서버에 RESULT로 보낸다.
 *   - 달리기 종목은 0.25초마다 달린 거리(PROGRESS)를 보내, 다른 선수 화면의 옆 레인에 내 선수가 달린다.
 *   - 기록을 보낸 뒤 서버 확인이 오기 전에 경기 화면이 다시 열리지 않도록, 이번 종목을 끝냈는지 로컬 State로도 기억한다.
 */
import { useState } from "react";
import type { CommonGameProperties } from "@/features/games/online/games/CommonGameArea";
import { olympicSchema, SEAT_COLORS } from "@/features/games/online/games/olympicRules";
import { OlympicEventPicker } from "@/features/games/olympic/OlympicEventPicker";
import { OlympicEventPlay } from "@/features/games/olympic/OlympicEventPlay";
import { formatMark, medalLabel, olympicEventIds, olympicEvents, type OlympicEventId } from "@/features/games/olympic/olympicEvents";

export const OlympicGame = ({ room, mySeat, connected, send }: CommonGameProperties) => {
  const [selected, setSelected] = useState<OlympicEventId[]>([...olympicEventIds]);
  const [finishedKey, setFinishedKey] = useState<string | null>(null);
  const parsed = olympicSchema.safeParse(room.game);
  const nameAt = (seat: number) => room.participants.find((participant) => participant.participantId === room.seats[seat])?.nickname ?? `${seat + 1}번 자리`;
  if (!parsed.success) {
    return <p className="online-hint">1~4명이 앉고 방장이 시작하면, 1번 선수가 이번 대회 종목(100m·110m 허들·멀리뛰기·창던지기·해머던지기·높이뛰기)을 고릅니다. 종목마다 각자 경기하고 순위대로 메달을 받습니다. 혼자면 기준 기록으로 메달을 받습니다.</p>;
  }
  const game = parsed.data;
  const playing = room.status === "PLAYING" && !game.finished;
  const me = mySeat !== null ? game.players[mySeat] : undefined;
  const eventKey = `${game.eventIndex}:${game.currentEvent ?? ""}:${game.events.join(",")}`;
  const current = game.currentEvent ?? null;

  const medalBoard = (
    <ol className="olympic-medals" aria-label="메달 순위">
      {game.players
        .map((player, seat) => ({ player, seat }))
        .sort((a, b) => b.player.gold - a.player.gold || b.player.silver - a.player.silver || b.player.bronze - a.player.bronze || a.seat - b.seat)
        .map(({ player, seat }) => (
          <li key={seat} className={`olympic-medal-row${game.winners.includes(seat) ? " winner" : ""}${player.active ? "" : " out"}`} style={{ borderColor: SEAT_COLORS[seat] }}>
            <strong>{nameAt(seat)}{seat === mySeat ? " (나)" : ""}</strong>
            <span>🥇{player.gold} 🥈{player.silver} 🥉{player.bronze}{player.active ? "" : " · 빠짐"}{game.winners.includes(seat) ? " · 우승" : ""}</span>
          </li>
        ))}
    </ol>
  );

  const resultTable = (index: number) => {
    const result = game.results[index];
    if (!result) return null;
    return (
      <table className="olympic-table" aria-label={`${olympicEvents[result.event].label} 결과`}>
        <caption>{olympicEvents[result.event].label}</caption>
        <thead><tr><th>선수</th><th>기록</th><th>메달</th></tr></thead>
        <tbody>
          {result.marks.map((mark, seat) => {
            const medal = result.medals[seat] ?? null;
            return (
              <tr key={seat}>
                <td>{nameAt(seat)}</td>
                <td>{formatMark(result.event, mark)}</td>
                <td>{medal ? medalLabel[medal] : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  let body;
  if (game.phase === "SELECT") {
    body = mySeat === 0 && playing ? (
      <div className="olympic-select">
        <OlympicEventPicker selected={selected} onChange={setSelected} disabled={!connected} />
        <button type="button" disabled={!connected || selected.length === 0}
          onClick={() => send({ type: "GAME_ACTION", action: "SELECT", numbers: selected.map((id) => olympicEventIds.indexOf(id)) })}>
          {selected.length}개 종목으로 개막
        </button>
      </div>
    ) : <p className="game-status">{nameAt(0)} 님이 이번 대회 종목을 고르고 있습니다…</p>;
  } else if (game.phase === "EVENT" && current) {
    const canPlay = playing && connected && me?.active === true && !me.submitted && finishedKey !== eventKey;
    const rivals = game.players
      .map((player, seat) => ({ player, seat }))
      .filter(({ player, seat }) => seat !== mySeat && player.active && player.progress != null)
      .map(({ player, seat }) => ({ name: nameAt(seat), color: SEAT_COLORS[seat] ?? "#868e96", x: (player.progress ?? 0) / 100, finished: player.submitted }));
    body = (
      <>
        <p className="game-status">{game.eventIndex + 1} / {game.events.length} 종목 — {olympicEvents[current].label}</p>
        {canPlay ? (
          <OlympicEventPlay
            key={eventKey}
            event={current}
            color={SEAT_COLORS[mySeat ?? 0] ?? "#e03131"}
            rivals={rivals}
            onProgress={(centimeters) => send({ type: "GAME_ACTION", action: "PROGRESS", number: centimeters })}
            onFinish={(mark) => {
              setFinishedKey(eventKey);
              send({ type: "GAME_ACTION", action: "RESULT", number: mark ?? -1 });
            }}
          />
        ) : (
          <ul className="olympic-waiting" aria-label="경기 상황">
            {game.players.map((player, seat) => (
              <li key={seat}>
                <span>{nameAt(seat)}</span>
                {olympicEvents[current].timed && <progress max={current === "SPRINT_100" ? 10_000 : 11_000} value={player.progress ?? 0} />}
                <span>{!player.active ? "빠짐" : player.submitted ? "기록 제출" : "경기 중…"}</span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  } else if (game.phase === "RESULT" && current) {
    const waiting = game.players.filter((player) => player.active && !player.ready).length;
    const last = game.eventIndex + 1 >= game.events.length;
    body = (
      <>
        <p className="game-status">{olympicEvents[current].label} 결과</p>
        {resultTable(game.results.length - 1)}
        {me?.active && !me.ready && playing ? (
          <button type="button" disabled={!connected} onClick={() => send({ type: "GAME_ACTION", action: "NEXT" })}>
            {last ? "폐막식으로" : `다음 종목: ${olympicEvents[game.events[game.eventIndex + 1] ?? current].label}`}
          </button>
        ) : <p className="online-hint">다른 선수 {waiting}명이 결과를 확인하는 중…</p>}
      </>
    );
  } else {
    body = (
      <>
        <p className="game-status">{room.lastResult ?? "대회가 끝났습니다"}</p>
        {game.results.map((_, index) => <div key={index}>{resultTable(index)}</div>)}
      </>
    );
  }

  return (
    <div className="olympic">
      {medalBoard}
      {body}
    </div>
  );
};
