/**
 * OlympicPractice.tsx — 올림픽 방에서 기다리는 동안 혼자 하는 대회
 *
 * 단계: 종목 고르기 → 고른 종목을 차례로 경기(OlympicEventPlay) → 종목마다 기록·메달 → 끝나면 요약.
 * 혼자일 때 메달은 기준 기록(medalStandards)으로 정한다. 종목별 개인 최고 기록은 localStorage에 둔다
 * (읽을 때 zod로 검사해, 망가진 값이 있어도 화면이 깨지지 않게).
 */
import { useState } from "react";
import { z } from "zod";
import { OlympicEventPicker } from "@/features/games/olympic/OlympicEventPicker";
import { OlympicEventPlay } from "@/features/games/olympic/OlympicEventPlay";
import {
  formatMark,
  isBetterMark,
  medalByStandard,
  medalLabel,
  olympicEventIds,
  olympicEvents,
  type OlympicEventId,
} from "@/features/games/olympic/olympicEvents";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";

const RECORD_KEY = "olympic.best";
const markSchema = z.number().int().positive().optional();
const bestSchema = z.object({
  SPRINT_100: markSchema, HURDLES_110: markSchema, LONG_JUMP: markSchema, JAVELIN: markSchema, HAMMER: markSchema, HIGH_JUMP: markSchema,
});
type BestMarks = Partial<Record<OlympicEventId, number>>;

type Stage = { kind: "SELECT" } | { kind: "PLAY"; index: number } | { kind: "RESULT"; index: number } | { kind: "END" };

export const OlympicPractice = () => {
  const [selected, setSelected] = useState<OlympicEventId[]>([...olympicEventIds]);
  const [stage, setStage] = useState<Stage>({ kind: "SELECT" });
  const [marks, setMarks] = useState<Partial<Record<OlympicEventId, number | null>>>({});
  const [best, setBest] = useState<BestMarks>(() => readGameRecord(RECORD_KEY, bestSchema) ?? {});
  const [newRecords, setNewRecords] = useState<OlympicEventId[]>([]);

  const finishEvent = (event: OlympicEventId, index: number, mark: number | null) => {
    setMarks((previous) => ({ ...previous, [event]: mark }));
    if (isBetterMark(event, mark, best[event] ?? null) && mark !== null) {
      const next = { ...best, [event]: mark };
      setBest(next);
      writeGameRecord(RECORD_KEY, next);
      setNewRecords((previous) => [...previous, event]);
    }
    setStage({ kind: "RESULT", index });
  };

  if (stage.kind === "SELECT") {
    return (
      <div className="olympic-practice">
        <OlympicEventPicker selected={selected} onChange={setSelected} />
        <button type="button" disabled={selected.length === 0} onClick={() => { setMarks({}); setNewRecords([]); setStage({ kind: "PLAY", index: 0 }); }}>
          {selected.length}개 종목 시작
        </button>
      </div>
    );
  }

  if (stage.kind === "PLAY") {
    const event = selected[stage.index];
    if (!event) return null;
    return (
      <div className="olympic-practice">
        <p className="online-hint">{stage.index + 1} / {selected.length} 종목</p>
        <OlympicEventPlay key={`${event}:${stage.index}`} event={event} color="#e03131" onFinish={(mark) => finishEvent(event, stage.index, mark)} />
      </div>
    );
  }

  const summary = (
    <table className="olympic-table">
      <thead><tr><th>종목</th><th>기록</th><th>메달</th><th>개인 최고</th></tr></thead>
      <tbody>
        {selected.filter((event) => event in marks).map((event) => {
          const mark = marks[event] ?? null;
          const medal = medalByStandard(event, mark);
          return (
            <tr key={event}>
              <td>{olympicEvents[event].label}</td>
              <td>{formatMark(event, mark)}{newRecords.includes(event) ? " ★신기록" : ""}</td>
              <td>{medal ? medalLabel[medal] : "-"}</td>
              <td>{formatMark(event, best[event] ?? null)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  if (stage.kind === "RESULT") {
    const last = stage.index >= selected.length - 1;
    return (
      <div className="olympic-practice">
        {summary}
        <button type="button" onClick={() => setStage(last ? { kind: "END" } : { kind: "PLAY", index: stage.index + 1 })}>
          {last ? "대회 끝 — 결과 보기" : `다음 종목: ${olympicEvents[selected[stage.index + 1] ?? "SPRINT_100"].label}`}
        </button>
      </div>
    );
  }

  const medals = selected.map((event) => medalByStandard(event, marks[event] ?? null));
  return (
    <div className="olympic-practice">
      <p className="game-status">
        대회 끝! 금 {medals.filter((medal) => medal === "GOLD").length} · 은 {medals.filter((medal) => medal === "SILVER").length} · 동 {medals.filter((medal) => medal === "BRONZE").length}
      </p>
      {summary}
      <button type="button" onClick={() => setStage({ kind: "SELECT" })}>다시 하기</button>
    </div>
  );
};
