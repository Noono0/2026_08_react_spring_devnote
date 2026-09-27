import { useEffect, useRef, useState } from "react";
import type { CrawlerBrowserWindow, CrawlerFieldRequest, CrawlerStepType } from "@/features/crawler/types/webCrawlerTypes";
import { useCrawlerLiveView, useCrawlerManualAction, useCrawlerRecording } from "@/features/crawler/hooks/useWebCrawler";
import { CrawlerLiveViewPanel } from "@/features/crawler/components/CrawlerLiveViewPanel";
import { CrawlerStepIcon } from "@/features/crawler/components/CrawlerStepIcon";
import { CrawlerStepDetails } from "@/features/crawler/components/CrawlerStepDetails";
import { createExtractionField, createNaverCafeExampleSteps, createStep, stepTypeOptions, toEditableSteps, type EditableScenarioStep, type StepProblem } from "@/features/crawler/utils/crawlerSteps";
import { markInvalidFields } from "@/shared/lib/formValidation";
import "@/features/crawler/components/crawlerWorkflow.css";

interface CrawlerStepEditorProps {
  steps: EditableScenarioStep[];
  onChange: (steps: EditableScenarioStep[]) => void;
  onLoadExample: (steps: EditableScenarioStep[]) => void;
  startUrl: string;
  browserWindow: CrawlerBrowserWindow;
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  disabled: boolean;
  onRun: (test: boolean) => void;
  onBeforeAddAction: () => boolean;
  commonFields: CrawlerFieldRequest[];
  commonItemSelector: string;
  focusProblem?: StepProblem & { requestId: number };
}

const statusLabels: Record<string, string> = { PENDING: "대기", RUNNING: "실행 중", DONE: "완료", BLOCKED: "확인 필요", WAITING: "사용자 대기", SKIPPED: "건너뜀", FAILED: "실패" };
const describe = (step: EditableScenarioStep): string => {
  if (step.memo) return step.memo;
  switch (step.type) {
    case "GOTO": return step.value || "열 페이지 주소를 입력해 주세요.";
    case "FILL": return `${step.target || "검색창 자동 탐색"}에 “${step.value}” 입력`;
    case "PRESS": return `${step.value || "Enter"} 키 입력`;
    case "WAIT": return `${step.value}ms 대기`;
    case "WAIT_FOR": return `${step.target || "대상 요소"}가 보일 때까지 대기 (최대 ${(step.timeoutMillis ?? 15000) / 1000}초)`;
    case "COLLECT": return `${step.target || "공통 수집 설정의 목록"}의 항목마다 반복`;
    case "CSV": return `${step.value || "crawler-result"} · 다운로드 시 날짜·시간 추가`;
    case "SCROLL": return `${step.value}px 스크롤`;
    default: return step.target || "행을 선택해 대상을 설정해 주세요.";
  }
};

export const CrawlerStepEditor = ({ steps, onChange, onLoadExample, startUrl, browserWindow, username, password, onUsernameChange, onPasswordChange, disabled, onRun, onBeforeAddAction, commonFields, commonItemSelector, focusProblem }: CrawlerStepEditorProps) => {
  const [selection, setSelection] = useState<{ stepId: string; fieldId?: string }>();
  const editorRef = useRef<HTMLElement>(null);
  const handledFocusRequest = useRef(0);
  const recording = useCrawlerRecording();
  const liveQuery = useCrawlerLiveView(true, disabled || recording.start.isSuccess);
  const live = liveQuery.data;
  const manual = useCrawlerManualAction();
  const isRecording = live?.recording === true;
  const locked = disabled || isRecording || recording.start.isPending;
  const selectedIndex = steps.findIndex((step) => step.id === selection?.stepId);
  const selected = steps[selectedIndex];
  const fieldIndex = selected?.fields?.findIndex((field) => field.id === selection?.fieldId) ?? -1;
  const selectedField = selected?.fields?.[fieldIndex];
  const selectedPosition = selectedField ? fieldIndex : selectedIndex;
  const selectedLength = selectedField ? selected?.fields?.length ?? 0 : steps.length;
  const isPaused = disabled && live?.stage === "일시정지" && live.manualActionRequired;
  useEffect(() => {
    if (!focusProblem || handledFocusRequest.current === focusProblem.requestId) return;
    if (focusProblem.stepId && (selection?.stepId !== focusProblem.stepId || selection?.fieldId !== focusProblem.fieldId)) {
      setSelection({ stepId: focusProblem.stepId, fieldId: focusProblem.fieldId });
      return;
    }
    handledFocusRequest.current = focusProblem.requestId;
    const inputs = [...(editorRef.current?.querySelectorAll<HTMLInputElement>("[data-step-id][data-step-field]") ?? [])];
    const input = inputs.find((candidate) => candidate.dataset.stepId === focusProblem.stepId
      && candidate.dataset.stepField === focusProblem.field
      && candidate.dataset.stepChildId === focusProblem.fieldId);
    if (input) {
      markInvalidFields([input]);
      return;
    }
    const buttons = [...(editorRef.current?.querySelectorAll<HTMLButtonElement>("[data-step-row-id]") ?? [])];
    const button = buttons.find((candidate) => candidate.dataset.stepRowId === focusProblem.stepId
      && candidate.dataset.stepChildId === focusProblem.fieldId)
      ?? editorRef.current?.querySelector<HTMLButtonElement>(".crawler-action-palette > button");
    button?.focus({ preventScroll: true });
    button?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [focusProblem, selection]);
  const update = (id: string, patch: Partial<EditableScenarioStep>): void => onChange(steps.map((step) => step.id === id ? { ...step, ...patch } : step));
  const insert = (step: EditableScenarioStep): void => {
    const next = [...steps];
    const insertion = selectedIndex < 0 ? (next.at(-1)?.type === "CSV" && step.type !== "CSV" ? next.length - 1 : next.length) : selectedIndex + 1;
    next.splice(insertion, 0, step);
    onChange(next);
    setSelection({ stepId: step.id });
  };
  const add = (type: CrawlerStepType): void => {
    if (!onBeforeAddAction()) return;
    insert(createStep(type, type === "GOTO" ? { value: startUrl } : type === "COLLECT" ? { targetMode: "SELECTOR", target: commonItemSelector, fields: commonFields } : {}));
  };
  const addExtraction = (): void => {
    if (!onBeforeAddAction()) return;
    const parent = selected?.type === "COLLECT" ? selected : undefined;
    if (parent) {
      const existing = parent.fields ?? commonFields.map(createExtractionField);
      const field = createExtractionField({ name: `데이터 ${existing.length + 1}`, selector: "", valueSource: "TEXT", attributeName: "" });
      update(parent.id, { fields: [...existing, field] });
      setSelection({ stepId: parent.id, fieldId: field.id });
    } else {
      const field = createExtractionField();
      const step = { ...createStep("COLLECT", { targetMode: "SELECTOR", target: commonItemSelector }), fields: [field] };
      insert(step);
      setSelection({ stepId: step.id, fieldId: field.id });
    }
  };
  const editSelection = (action: "up" | "down" | "copy" | "delete"): void => {
    if (!selected) return;
    if (selectedField) {
      const fields = [...(selected.fields ?? [])];
      if (action === "copy") {
        let name = `${selectedField.name} 복사`;
        while (fields.some((field) => field.name === name)) name += " 복사";
        const copied = createExtractionField({ ...selectedField, name });
        fields.splice(fieldIndex + 1, 0, copied);
        setSelection({ stepId: selected.id, fieldId: copied.id });
      } else if (action === "delete") {
        fields.splice(fieldIndex, 1);
        setSelection({ stepId: selected.id });
      } else {
        const to = fieldIndex + (action === "up" ? -1 : 1);
        if (to < 0 || to >= fields.length) return;
        fields.splice(fieldIndex, 1);
        fields.splice(to, 0, selectedField);
      }
      update(selected.id, { fields });
      return;
    }
    const next = [...steps];
    if (action === "copy") {
      const copied = createStep(selected.type, selected);
      next.splice(selectedIndex + 1, 0, copied);
      setSelection({ stepId: copied.id });
    } else if (action === "delete") {
      next.splice(selectedIndex, 1);
      const neighbor = next[Math.min(selectedIndex, next.length - 1)];
      setSelection(neighbor ? { stepId: neighbor.id } : undefined);
    } else {
      const to = selectedIndex + (action === "up" ? -1 : 1);
      if (to < 0 || to >= next.length) return;
      next.splice(selectedIndex, 1);
      next.splice(to, 0, selected);
    }
    onChange(next);
  };

  return <section ref={editorRef} className="crawler-config-section crawler-workflow">
    <header><span>▶</span><div><h2>단계별 실행</h2><p>동작 추가 → 행 선택 → 설정. 목록 반복을 선택하면 그 안에 데이터 추출을 추가할 수 있습니다.</p></div></header>
    <div className="crawler-workflow-toolbar">
      <button type="button" className="secondary-button" disabled={locked || steps.length === 0} onClick={() => onRun(true)}>▷ 테스트 실행</button>
      <button type="button" className="primary-button" disabled={locked || steps.length === 0} onClick={() => onRun(false)}>▶ 실행</button>
      <button type="button" className="secondary-button" disabled={!disabled || manual.isPending || (!isPaused && (live?.runStatus !== "RUNNING" || live.pauseRequested))} onClick={() => manual.mutate({ action: isPaused ? "CONTINUE" : "PAUSE" })}>{isPaused ? "▶ 재개" : live?.pauseRequested ? "일시정지 요청됨" : "Ⅱ 일시정지"}</button>
      <small>테스트: 최대 1페이지·3건 / 일시정지: 현재 동작이 끝난 뒤 적용</small>
    </div>
    {manual.isError ? <p role="alert" className="field-error">실행 제어 요청을 보내지 못했습니다. 실행 상태를 확인한 뒤 다시 시도해 주세요.</p> : null}
    <div className="crawler-workflow-layout">
      <aside className="crawler-action-palette" aria-label="동작 추가"><h3>동작 추가</h3>
        {stepTypeOptions.filter((option) => !["WAIT", "MANUAL"].includes(option.value)).map((option) => <button type="button" key={option.value} disabled={locked || steps.length >= 100} onClick={() => add(option.value)}><CrawlerStepIcon type={option.value} />{option.label}</button>)}
        <button type="button" disabled={locked || (selected?.type === "COLLECT" && (selected.fields ?? commonFields).length >= 12) || (selected?.type !== "COLLECT" && steps.length >= 100)} onClick={addExtraction}><CrawlerStepIcon type="EXTRACT" />데이터 추출</button>
        <details open><summary>대기·직접 처리</summary>{stepTypeOptions.filter((option) => ["WAIT", "MANUAL"].includes(option.value)).map((option) => <button type="button" key={option.value} disabled={locked || steps.length >= 100} onClick={() => add(option.value)}><CrawlerStepIcon type={option.value} />{option.label}</button>)}</details>
      </aside>
      <div className="crawler-workflow-main">
        <div className="crawler-workflow-title"><h3>작업 단계</h3><small>{steps.length}개 단계</small></div>
        <div className="crawler-workflow-table-and-tools"><div className="crawler-workflow-table-wrap">
          <table className="crawler-workflow-table"><caption>실행 순서와 목록 반복 하위 추출 단계</caption><thead><tr><th scope="col">순서</th><th scope="col">동작 · 설명</th><th scope="col">상태</th></tr></thead>
            {steps.map((step, index) => {
              const progress = live?.steps.length === steps.length ? live.steps[index] : undefined;
              return <tbody key={step.id} className={step.type === "COLLECT" ? "crawler-loop-group" : undefined}>
                <tr className={`${selection?.stepId === step.id && !selection.fieldId ? "is-selected" : ""} ${progress?.status === "RUNNING" && disabled ? "is-running" : ""}`}>
                  <td>{index + 1}</td><td><button type="button" data-step-row-id={step.id} aria-pressed={selection?.stepId === step.id && !selection.fieldId} onClick={() => setSelection({ stepId: step.id })}><span><CrawlerStepIcon type={step.type} /><strong>{stepTypeOptions.find((option) => option.value === step.type)?.label}</strong>{step.type === "COLLECT" ? <em>묶음 · 하위 {step.fields?.length ?? 0}개</em> : null}</span><small>{describe(step)}</small></button></td>
                  <td><span className={`crawler-workflow-status status-${progress?.status.toLowerCase() ?? "pending"}`}>{progress ? statusLabels[progress.status] : "대기"}</span></td>
                </tr>
                {step.type === "COLLECT" ? step.fields?.map((field, childIndex) => <tr key={field.id} className={`crawler-extraction-row ${selection?.fieldId === field.id ? "is-selected" : ""}`}><td>{index + 1}-{childIndex + 1}</td><td colSpan={2}><button type="button" data-step-row-id={step.id} data-step-child-id={field.id} aria-pressed={selection?.fieldId === field.id} onClick={() => setSelection({ stepId: step.id, fieldId: field.id })}><span><CrawlerStepIcon type="EXTRACT" /><strong>{field.name || "데이터"} 추출</strong></span><small>{field.selector || "항목 전체"}에서 {field.valueSource === "TEXT" ? "텍스트" : field.attributeName || "속성"} 추출</small></button></td></tr>) : null}
                {step.type === "COLLECT" && step.fields === undefined ? <tr className="crawler-extraction-row"><td /><td colSpan={2}><small>공통 수집 설정 사용 · 선택 후 ‘데이터 추출’로 개별 설정</small></td></tr> : null}
              </tbody>;
            })}
          </table>
          {steps.length === 0 ? <div className="crawler-workflow-empty"><CrawlerStepIcon type="COLLECT" /><strong>첫 동작을 추가해 보세요</strong><p>왼쪽 ‘페이지 열기’부터 시작하거나 아래 예시를 불러오세요.</p></div> : null}
        </div><div className="crawler-workflow-actions" aria-label="선택한 단계 편집">
          <button type="button" disabled={locked || !selected || selectedPosition === 0} onClick={() => editSelection("up")}><span aria-hidden="true">↑</span>위로</button>
          <button type="button" disabled={locked || !selected || selectedPosition === selectedLength - 1} onClick={() => editSelection("down")}><span aria-hidden="true">↓</span>아래로</button>
          <button type="button" disabled={locked || !selected || (selectedField ? selectedLength >= 12 : steps.length >= 100)} onClick={() => editSelection("copy")}><span aria-hidden="true">▢</span>복사</button>
          <button type="button" className="crawler-delete-action" disabled={locked || !selected} onClick={() => editSelection("delete")}><span aria-hidden="true">×</span>삭제</button>
        </div></div>
        <p className="crawler-selection-hint">{selected ? `선택: ${selectedField ? `${selectedField.name} 추출` : stepTypeOptions.find((option) => option.value === selected.type)?.label}` : "행을 선택하면 아래에서 상세 설정을 편집할 수 있습니다."}</p>
        {selected ? <CrawlerStepDetails step={selected} field={selectedField} disabled={locked} onChange={(patch) => update(selected.id, patch)} onFieldChange={(patch) => update(selected.id, { fields: selected.fields?.map((field) => field.id === selectedField?.id ? { ...field, ...patch } : field) })} /> : null}
      </div>
    </div>
    <section className="crawler-workflow-log" aria-label="실행 로그"><div className="crawler-workflow-title"><h3>실행 로그</h3><strong>수집 {live?.collectedCount ?? 0}건</strong></div>
      <p role="status">{disabled ? live?.stage || "실행 준비 중" : live?.finalReason || "실행하면 단계별 진행 상황이 여기에 표시됩니다."}</p>
      {liveQuery.isError ? <p className="field-error">실행 상태를 가져오지 못했습니다.</p> : null}
      <div className="crawler-workflow-log-scroll"><table><thead><tr><th scope="col">시간</th><th scope="col">단계</th><th scope="col">메시지</th></tr></thead><tbody>{live?.logs?.map((log, index) => <tr key={`${log.time}-${index}`}><td>{new Date(log.time).toLocaleTimeString("ko-KR", { hour12: false })}</td><td>{log.step}</td><td><span className={`status-${log.status.toLowerCase()}`}>{statusLabels[log.status] ?? log.status}</span> · {log.message}</td></tr>)}</tbody></table></div>
    </section>
    <details className="crawler-workflow-extras" open><summary>예시·녹화·계정정보</summary>
      <div className="crawler-workflow-toolbar"><button type="button" className="secondary-button" disabled={locked} onClick={() => { onLoadExample(createNaverCafeExampleSteps(startUrl.trim() || "https://cafe.naver.com/lhuniv9", "LH")); setSelection(undefined); }}>네이버 카페 검색 예시 불러오기</button>
        <button type="button" className="secondary-button" disabled={disabled || recording.start.isPending || recording.stop.isPending || !startUrl.trim()} onClick={() => isRecording ? recording.stop.mutate() : recording.start.mutate({ startUrl: startUrl.trim(), browserWindow })}>{isRecording ? "■ 녹화 종료" : "● 녹화로 만들기"}</button></div>
      {recording.start.isError || recording.stop.isError ? <p className="field-error">녹화 요청을 처리하지 못했습니다. 다른 실행이 진행 중인지 확인해 주세요.</p> : null}
      {isRecording ? <><p>브라우저에서 클릭·입력을 진행하고 ‘녹화 종료’를 눌러 주세요.</p><CrawlerLiveViewPanel running /></> : null}
      {recording.start.isSuccess && !isRecording && (live?.recordedSteps.length ?? 0) > 0 ? <div><p>녹화한 동작 {live?.recordedSteps.length}개</p><button type="button" className="secondary-button" disabled={locked} onClick={() => { onChange(toEditableSteps(live?.recordedSteps ?? [])); setSelection(undefined); recording.start.reset(); }}>녹화 결과로 단계 바꾸기</button><button type="button" className="secondary-button" disabled={locked || steps.length + (live?.recordedSteps.length ?? 0) > 100} onClick={() => { onChange([...steps, ...toEditableSteps(live?.recordedSteps ?? [])]); recording.start.reset(); }}>기존 단계 뒤에 붙이기</button></div> : null}
      <div className="crawler-login-panel"><p className="crawler-full-field">텍스트 입력 값에 <code>{"{{username}}"}</code>, <code>{"{{password}}"}</code>를 쓰면 아래 값으로 입력합니다.</p><label>아이디<input disabled={locked} autoComplete="off" value={username} onChange={(event) => onUsernameChange(event.target.value)} /></label><label>비밀번호<input disabled={locked} type="text" autoComplete="off" value={password} onChange={(event) => onPasswordChange(event.target.value)} /></label></div>
    </details>
  </section>;
};
