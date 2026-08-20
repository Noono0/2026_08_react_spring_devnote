import { useMemo, useState, type FormEvent } from "react";
import type { Poll, PollDefinitionRequest } from "@/features/utility/types/pollTypes";
import {
  createAbsoluteEndsAt,
  createRelativeEndsAt,
  MAXIMUM_POLL_DURATION_MINUTES,
  MAXIMUM_POLL_OPTION_COUNT,
  toDateTimeLocalValue,
} from "@/features/utility/utils/pollRules";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { createUuid } from "@/shared/lib/createUuid";

interface EditablePollOption {
  key: string;
  value: string;
}

interface PollEditorProps {
  initialPoll?: Poll;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (request: PollDefinitionRequest) => Promise<void>;
}

const createOptionKey = (): string => createUuid();

export const PollEditor = ({ initialPoll, pending, onCancel, onSubmit }: PollEditorProps) => {
  const [question, setQuestion] = useState(initialPoll?.question ?? "");
  const [options, setOptions] = useState<EditablePollOption[]>(
    initialPoll?.options.map((option) => ({ key: `option-${option.optionId}`, value: option.label }))
      ?? [{ key: createOptionKey(), value: "" }, { key: createOptionKey(), value: "" }],
  );
  const [allowMultiple, setAllowMultiple] = useState(initialPoll?.allowMultiple ?? false);
  const [maxSelections, setMaxSelections] = useState(initialPoll?.maxSelections ?? 1);
  const [realtimeResults, setRealtimeResults] = useState(initialPoll?.realtimeResults ?? true);
  const [timeEnabled, setTimeEnabled] = useState(Boolean(initialPoll));
  const [timeMode, setTimeMode] = useState<"RELATIVE" | "ABSOLUTE">(initialPoll ? "ABSOLUTE" : "RELATIVE");
  const [relativeMinutes, setRelativeMinutes] = useState(10);
  const [absoluteEndsAt, setAbsoluteEndsAt] = useState(
    initialPoll ? toDateTimeLocalValue(new Date(initialPoll.endsAt)) : toDateTimeLocalValue(new Date(Date.now() + 10 * 60_000)),
  );
  const optionEditingLocked = (initialPoll?.participantCount ?? 0) > 0;
  const absoluteMinimum = useMemo(() => toDateTimeLocalValue(new Date(Date.now() + 60_000)), []);
  const absoluteMaximum = useMemo(() => toDateTimeLocalValue(new Date(Date.now() + MAXIMUM_POLL_DURATION_MINUTES * 60_000)), []);

  const updateOption = (key: string, value: string): void => {
    setOptions((currentOptions) => currentOptions.map((option) => option.key === key ? { ...option, value } : option));
  };

  const addOption = (): void => {
    if (options.length >= MAXIMUM_POLL_OPTION_COUNT) return;
    const nextOptions = [...options, { key: createOptionKey(), value: "" }];
    setOptions(nextOptions);
    // 복수 선택을 처음 켰을 때뿐 아니라 문항 추가 중에도 기본값은 전체 문항 수를 따라갑니다.
    if (allowMultiple && maxSelections === options.length) setMaxSelections(nextOptions.length);
  };

  const removeOption = (key: string): void => {
    if (options.length <= 2) return;
    const nextOptions = options.filter((option) => option.key !== key);
    setOptions(nextOptions);
    if (allowMultiple) setMaxSelections(Math.max(2, Math.min(maxSelections, nextOptions.length)));
  };

  const toggleMultiple = (checked: boolean): void => {
    setAllowMultiple(checked);
    // 요구사항대로 체크하는 순간 현재 문항 수가 최대 선택 수의 기본값이 됩니다.
    setMaxSelections(checked ? options.length : 1);
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const normalizedOptions = options.map((option) => option.value.trim());
    if (normalizedOptions.some((option) => !option)) {
      applicationNotification.warning("모든 문항을 입력해 주세요.");
      return;
    }
    if (new Set(normalizedOptions.map((option) => option.toLowerCase())).size !== normalizedOptions.length) {
      applicationNotification.warning("같은 문항을 중복해서 등록할 수 없습니다.");
      return;
    }

    let endsAt: string | undefined;
    if (timeEnabled) {
      endsAt = timeMode === "RELATIVE"
        ? createRelativeEndsAt(relativeMinutes)
        : createAbsoluteEndsAt(absoluteEndsAt);
      if (!endsAt) {
        applicationNotification.warning("종료 시간을 확인해 주세요.");
        return;
      }
    }

    await onSubmit({ question: question.trim(), options: normalizedOptions, allowMultiple, maxSelections, realtimeResults, endsAt });
  };

  return (
    <form className="poll-editor" onSubmit={(event) => void submit(event)}>
      <div className="poll-editor-heading">
        <div><span className="page-kicker">Poll Builder</span><h2>{initialPoll ? "투표 수정" : "새 토픽 만들기"}</h2></div>
        <button type="button" className="ghost-button" onClick={onCancel}>닫기</button>
      </div>

      <label className="poll-title-field">제목<input value={question} maxLength={300} placeholder="예: 오늘 점심 메뉴는?" onChange={(event) => setQuestion(event.target.value)} required /></label>

      <fieldset className="poll-option-builder">
        <legend>투표 문항 <span>{options.length}/{MAXIMUM_POLL_OPTION_COUNT}</span></legend>
        {optionEditingLocked ? <p className="poll-editor-notice">이미 참여자가 있어 문항 내용과 개수는 고정됩니다. 제목·선택 수·공개 방식·종료 시간은 수정할 수 있습니다.</p> : null}
        {options.map((option, index) => (
          <div className="poll-option-input-row" key={option.key}>
            <span>{index + 1}</span>
            <input aria-label={`문항 ${index + 1}`} value={option.value} maxLength={200} disabled={optionEditingLocked} placeholder={`문항 ${index + 1}`} onChange={(event) => updateOption(option.key, event.target.value)} required />
            <button type="button" className="ghost-button danger-button" disabled={optionEditingLocked || options.length <= 2} onClick={() => removeOption(option.key)}>삭제</button>
          </div>
        ))}
        <button type="button" className="poll-add-option-button" disabled={optionEditingLocked || options.length >= MAXIMUM_POLL_OPTION_COUNT} onClick={addOption}>+ 문항 추가</button>
      </fieldset>

      <div className="poll-setting-grid">
        <section>
          <label className="poll-toggle-row"><span><strong>중복 투표 허용</strong><small>한 번 제출할 때 여러 문항 선택</small></span><input type="checkbox" checked={allowMultiple} onChange={(event) => toggleMultiple(event.target.checked)} /></label>
          {allowMultiple ? <label className="poll-number-setting">최대 선택 수<input type="number" min={2} max={options.length} value={maxSelections} onChange={(event) => setMaxSelections(Number(event.target.value))} /><span>2개 이상, 현재 {options.length}개 이하</span></label> : null}
        </section>
        <section>
          <label className="poll-toggle-row"><span><strong>실시간 투표 공개</strong><small>투표 중에도 막대그래프 표시</small></span><input type="checkbox" checked={realtimeResults} onChange={(event) => setRealtimeResults(event.target.checked)} /></label>
        </section>
        <section className="poll-time-setting">
          <label className="poll-toggle-row"><span><strong>종료 시간 설정</strong><small>설정하지 않으면 60분 뒤 종료</small></span><input type="checkbox" checked={timeEnabled} onChange={(event) => setTimeEnabled(event.target.checked)} /></label>
          {timeEnabled ? <div className="poll-time-fields">
            <div className="poll-segmented-control">
              <button type="button" className={timeMode === "RELATIVE" ? "active" : undefined} onClick={() => setTimeMode("RELATIVE")}>몇 분 뒤</button>
              <button type="button" className={timeMode === "ABSOLUTE" ? "active" : undefined} onClick={() => setTimeMode("ABSOLUTE")}>직접 설정</button>
            </div>
            {timeMode === "RELATIVE" ? <label>종료까지<input type="number" min={1} max={MAXIMUM_POLL_DURATION_MINUTES} value={relativeMinutes} onChange={(event) => setRelativeMinutes(Number(event.target.value))} />분</label> : <label>종료 일시<input type="datetime-local" min={absoluteMinimum} max={absoluteMaximum} value={absoluteEndsAt} onChange={(event) => setAbsoluteEndsAt(event.target.value)} /></label>}
          </div> : null}
        </section>
      </div>

      <div className="poll-editor-actions">
        <p>투표는 생성 시점부터 최대 60분 동안 진행됩니다.</p>
        <button type="submit" disabled={pending}>{pending ? "저장 중..." : initialPoll ? "수정 저장" : "투표 만들기"}</button>
      </div>
    </form>
  );
};
