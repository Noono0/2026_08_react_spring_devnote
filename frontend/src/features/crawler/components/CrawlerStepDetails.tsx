import type { CrawlerTargetMode, CrawlerValueSource } from "@/features/crawler/types/webCrawlerTypes";
import { RequiredMark } from "@/features/crawler/components/RequiredMark";
import { stepRequiresTarget, stepRequiresValue, stepTypeOptions, stepUsesTarget, stepValueLabel, targetModeOptions, type EditableExtractionField, type EditableScenarioStep } from "@/features/crawler/utils/crawlerSteps";

interface Props {
  step: EditableScenarioStep;
  field?: EditableExtractionField;
  disabled: boolean;
  onChange: (patch: Partial<EditableScenarioStep>) => void;
  onFieldChange: (patch: Partial<EditableExtractionField>) => void;
}

export const CrawlerStepDetails = ({ step, field, disabled, onChange, onFieldChange }: Props) => {
  const valueLabel = stepValueLabel(step.type);
  const numberOrNull = (value: string): number | null => value.trim() === "" ? null : Number(value);
  return <fieldset disabled={disabled} className="crawler-selected-settings">
    <legend>{field ? `${field.name || "데이터"} 추출 설정` : `${stepTypeOptions.find((option) => option.value === step.type)?.label} 설정`}</legend>
    {field ? <>
      <label><span><RequiredMark /> 추출 이름</span><input required maxLength={40} value={field.name} data-step-id={step.id} data-step-child-id={field.id} data-step-field="name" onChange={(event) => onFieldChange({ name: event.target.value })} placeholder="예: 상품명" /></label>
      <label>항목 안에서 찾을 선택자<input value={field.selector} maxLength={500} onChange={(event) => onFieldChange({ selector: event.target.value })} placeholder="예: .product-title · 비우면 항목 전체" /></label>
      <label>추출할 값<select value={field.valueSource} onChange={(event) => onFieldChange({ valueSource: event.target.value as CrawlerValueSource })}><option value="TEXT">텍스트</option><option value="ATTRIBUTE">HTML 속성 (링크·이미지 주소 등)</option></select></label>
      {field.valueSource === "ATTRIBUTE" ? <label><span><RequiredMark /> 속성 이름</span><input required value={field.attributeName} data-step-id={step.id} data-step-child-id={field.id} data-step-field="attributeName" onChange={(event) => onFieldChange({ attributeName: event.target.value })} placeholder="href, src" /></label> : null}
      <p>목록의 각 항목 안에서 이 값을 읽어 ‘{field.name || "새 데이터"}’ 열에 저장합니다.</p>
    </> : <>
      {stepUsesTarget(step.type) ? <>
        {step.type !== "COLLECT" ? <label>대상 찾는 방법<select value={step.targetMode} onChange={(event) => onChange({ targetMode: event.target.value as CrawlerTargetMode })}>{targetModeOptions.filter((option) => step.type !== "WAIT_FOR" || option.value !== "COORDINATE").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
        {step.targetMode !== "COORDINATE" || step.type === "COLLECT" ? <label><span>{stepRequiresTarget(step) ? <RequiredMark /> : null} {step.type === "COLLECT" ? "목록 반복 대상 선택자" : step.targetMode === "TEXT" ? "대상 글자" : "대상 선택자"}</span>
          <input required={stepRequiresTarget(step)} maxLength={500} value={step.target} data-step-id={step.id} data-step-field="target"
            onChange={(event) => onChange({ target: event.target.value, ...(step.type === "COLLECT" ? { targetMode: "SELECTOR" as const } : {}) })}
            placeholder={step.type === "COLLECT" ? "예: .product-item · 비우면 공통 수집 설정" : step.targetMode === "TEXT" ? "예: 검색, 로그인, 카페글 검색어 입력" : "예: #search, button.submit"} /></label>
          : <>{(["x", "y"] as const).map((axis) => <label key={axis}><span><RequiredMark /> {axis}</span><input required type="number" min={0} max={5000} value={step[axis] ?? ""} data-step-id={step.id} data-step-field={axis} onChange={(event) => onChange({ [axis]: numberOrNull(event.target.value) })} /></label>)}</>}
      </> : null}
      {valueLabel ? <label><span>{stepRequiresValue(step.type) ? <RequiredMark /> : null} {valueLabel}</span><input required={stepRequiresValue(step.type)} value={step.value} data-step-id={step.id} data-step-field="value" type={step.type === "GOTO" ? "url" : ["WAIT", "SCROLL"].includes(step.type) ? "number" : "text"} onChange={(event) => onChange({ value: event.target.value })} /></label> : null}
      {stepUsesTarget(step.type) && step.type !== "COLLECT" ? <label>요소 대기 제한(ms)<input type="number" min={0} max={600000} step={1000} value={step.timeoutMillis ?? ""} data-step-id={step.id} data-step-field="timeoutMillis" placeholder="기본 15000" onChange={(event) => onChange({ timeoutMillis: numberOrNull(event.target.value) })} /></label> : null}
      <label>설명 · 메모<input value={step.memo} maxLength={200} onChange={(event) => onChange({ memo: event.target.value })} placeholder="이 단계에서 할 일을 적어 주세요." /></label>
      <p>{stepTypeOptions.find((option) => option.value === step.type)?.help}</p>
    </>}
  </fieldset>;
};
