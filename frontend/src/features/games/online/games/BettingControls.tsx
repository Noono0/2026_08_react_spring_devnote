/**
 * BettingControls.tsx — 베팅 버튼(섯다·포커 공용). 서버 BettingRound의 CHECK·CALL·RAISE·FOLD를 보낸다.
 *
 * toCall: 내가 맞춰야 할 칩(0이면 체크 가능) · minRaise·maxRaise: 올릴 수 있는 범위(maxRaise 0이면 올릴 수 없음)
 * foldLabel: 섯다는 "다이", 포커는 "폴드"
 */
import { useState } from "react";

interface BettingControlsProperties {
  toCall: number;
  minRaise: number;
  maxRaise: number;
  disabled: boolean;
  foldLabel: string;
  onAct: (action: "CHECK" | "CALL" | "RAISE" | "FOLD", amount?: number) => void;
}

export const BettingControls = ({ toCall, minRaise, maxRaise, disabled, foldLabel, onAct }: BettingControlsProperties) => {
  const [raise, setRaise] = useState(minRaise);
  const lowest = Math.min(minRaise, maxRaise);
  const amount = Math.max(lowest, Math.min(raise, maxRaise));
  return (
    <div className="betting-controls" role="group" aria-label="베팅">
      {toCall > 0 ? (
        <button type="button" disabled={disabled} onClick={() => onAct("CALL")}>콜 ({toCall}칩)</button>
      ) : (
        <button type="button" disabled={disabled} onClick={() => onAct("CHECK")}>체크</button>
      )}
      {maxRaise > 0 ? (
        <span className="betting-raise">
          <label htmlFor="betting-raise-input">올릴 칩</label>
          <input
            id="betting-raise-input"
            type="number"
            min={lowest}
            max={maxRaise}
            step={10}
            value={amount}
            disabled={disabled}
            onChange={(event) => setRaise(Number(event.target.value) || lowest)}
          />
          <button type="button" className="ghost-button" disabled={disabled} onClick={() => onAct("RAISE", amount)}>레이즈 +{amount}</button>
        </span>
      ) : null}
      <button type="button" className="danger-button" disabled={disabled} onClick={() => onAct("FOLD")}>{foldLabel}</button>
    </div>
  );
};
