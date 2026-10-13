/**
 * OlympicEventPicker.tsx — 이번 대회에서 할 종목 고르기(한 개 이상, 순서는 목록 순서)
 * 고른 값은 부모가 들고 있다(혼자 연습은 로컬 State, 온라인은 고른 뒤 서버로 보냄).
 */
import { olympicEventIds, olympicEvents, type OlympicEventId } from "@/features/games/olympic/olympicEvents";

interface OlympicEventPickerProps {
  selected: OlympicEventId[];
  onChange: (selected: OlympicEventId[]) => void;
  disabled?: boolean;
}

export const OlympicEventPicker = ({ selected, onChange, disabled = false }: OlympicEventPickerProps) => {
  const toggle = (id: OlympicEventId) => {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    onChange(olympicEventIds.filter((item) => next.includes(item)));
  };
  return (
    <fieldset className="olympic-picker" disabled={disabled}>
      <legend>종목 고르기 ({selected.length}개)</legend>
      <div className="olympic-picker-list">
        {olympicEventIds.map((id) => (
          <label key={id} className={`olympic-picker-item${selected.includes(id) ? " checked" : ""}`}>
            <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
            <span>
              <strong>{olympicEvents[id].label}</strong>
              <small>{olympicEvents[id].timed ? "1번 달리기" : id === "HIGH_JUMP" ? "실패 3번까지" : "3번 시도"} · 세계 기록 {olympicEvents[id].worldRecord}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="button-row">
        <button type="button" className="ghost-button" onClick={() => onChange([...olympicEventIds])}>전 종목</button>
        <button type="button" className="ghost-button" onClick={() => onChange(["SPRINT_100", "HURDLES_110"])}>달리기만</button>
        <button type="button" className="ghost-button" onClick={() => onChange(["LONG_JUMP", "HIGH_JUMP"])}>뛰기만</button>
        <button type="button" className="ghost-button" onClick={() => onChange(["JAVELIN", "HAMMER"])}>던지기만</button>
      </div>
    </fieldset>
  );
};
