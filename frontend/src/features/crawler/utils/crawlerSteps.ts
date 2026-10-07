/**
 * crawlerSteps.ts — 단계별 실행 편집기의 데이터 규칙(순수 함수·상수)
 *   - 단계 종류 목록·도움말, 종류별로 필요한 칸(대상·값) 판단
 *   - 화면용 단계(id 포함) ↔ 서버 요청용 단계(id 없음) 변환
 *   - 저장·실행 전 빈 필수 칸 찾기(validateSteps)
 * 화면 컴포넌트와 분리해 두어 crawlerSteps.test.ts에서 규칙만 따로 테스트한다.
 */

import { createUuid } from "@/shared/lib/createUuid";
import type { CrawlerFieldRequest, CrawlerScenarioStep, CrawlerStepType, CrawlerTargetMode } from "@/features/crawler/types/webCrawlerTypes";

/** 화면에서 순서를 바꾸고 지울 때 React key로 쓸 id를 붙인 단계 */
export interface EditableExtractionField extends CrawlerFieldRequest { id: string }
export const createExtractionField = (field: CrawlerFieldRequest = { name: "새 데이터", selector: "", valueSource: "TEXT", attributeName: "" }): EditableExtractionField => ({ ...field, id: createUuid() });

/** 화면에서 다루는 단계. 서버 단계(CrawlerScenarioStep)에 React key용 id를 더하고, 추출 칸도 id가 있는 모양으로 바꾼다. */
export interface EditableScenarioStep extends Omit<CrawlerScenarioStep, "fields"> {
  id: string;
  fields?: EditableExtractionField[];
}

// 동작 추가 버튼과 설정 화면에 보여 줄 단계 종류(이름·도움말).
export const stepTypeOptions: { value: CrawlerStepType; label: string; help: string }[] = [
  { value: "GOTO", label: "페이지 열기", help: "값에 적은 주소로 이동합니다." },
  { value: "CLICK", label: "요소 클릭", help: "대상(글자·선택자·좌표)을 클릭합니다." },
  { value: "FILL", label: "텍스트 입력", help: "대상 입력칸에 값을 입력합니다. 대상을 비우면 검색창을 자동으로 찾습니다. {{username}}, {{password}}는 아래 계정정보로 바뀝니다." },
  { value: "PRESS", label: "키 입력", help: "값의 키(Enter, Tab 등)를 누릅니다. 대상이 있으면 그 요소에서 누릅니다." },
  { value: "WAIT", label: "대기", help: "값(밀리초)만큼 기다립니다. 예: 1500" },
  { value: "WAIT_FOR", label: "요소 기다리기", help: "대상이 화면에 보일 때까지 기다립니다. 제한 시간은 아래에서 정합니다." },
  { value: "MANUAL", label: "직접 처리(캡차 등)", help: "멈추고 사람이 처리하기를 기다립니다. 대상을 적으면 그 글자·요소가 보이는 순간 자동으로 계속합니다." },
  { value: "COLLECT", label: "목록 반복", help: "목록의 각 항목마다 하위 추출 단계를 실행합니다. 이 단계에 대상과 추출 항목이 없으면 아래 공통 수집 설정을 사용합니다." },
  { value: "SCROLL", label: "스크롤", help: "입력한 픽셀만큼 화면을 내립니다. 음수는 위로 올립니다." },
  { value: "NEXT_PAGE", label: "다음 페이지", help: "대상 버튼을 한 번 클릭합니다. 여러 페이지 수집은 목록 반복의 공통 최대 페이지 설정을 사용하세요." },
  { value: "CSV", label: "CSV 저장", help: "마지막 단계에 놓으면 실행 성공 후 수집 결과를 CSV로 다운로드합니다. 브라우저에서 다운로드를 차단하면 결과의 CSV 버튼을 이용하세요." },
];

export const targetModeOptions: { value: CrawlerTargetMode; label: string }[] = [
  { value: "TEXT", label: "화면 글자" },
  { value: "SELECTOR", label: "CSS 선택자" },
  { value: "COORDINATE", label: "좌표 (x, y)" },
];

/** 대상(어디를)이 필요한 단계 */
export const stepUsesTarget = (type: CrawlerStepType): boolean =>
  type === "CLICK" || type === "FILL" || type === "PRESS" || type === "WAIT_FOR" || type === "MANUAL" || type === "COLLECT" || type === "NEXT_PAGE";

/** 값 입력칸이 필요한 단계와 그 이름 */
export const stepValueLabel = (type: CrawlerStepType): string | null => ({
  GOTO: "이동할 주소",
  FILL: "입력할 값",
  PRESS: "누를 키",
  WAIT: "대기 시간(ms)",
  MANUAL: "안내 문구",
  CLICK: null,
  WAIT_FOR: null,
  COLLECT: null,
  SCROLL: "스크롤 거리(px)",
  NEXT_PAGE: null,
  CSV: "파일 이름 (날짜·시간 자동 추가)",
// satisfies: 객체가 "모든 단계 종류를 빠짐없이 가진 표"인지 검사만 하고, 값의 타입은 그대로 둔다(종류를 추가하면 여기서 컴파일 오류).
} satisfies Record<CrawlerStepType, string | null>)[type];

const createId = (): string => createUuid();

/** 새 단계를 만든다. 종류별 기본값(키 입력은 Enter, 대기는 1000ms …)을 채우고 partial로 받은 값으로 덮어쓴 뒤 새 id를 붙인다. */
export const createStep = (type: CrawlerStepType = "CLICK", partial: Partial<CrawlerScenarioStep> = {}): EditableScenarioStep => ({
  type,
  targetMode: "TEXT",
  target: "",
  x: null,
  y: null,
  value: type === "PRESS" ? "Enter" : type === "WAIT" ? "1000" : type === "SCROLL" ? "600" : type === "CSV" ? "crawler-result" : "",
  memo: "",
  timeoutMillis: null,
  ...partial,
  id: createId(),
  fields: partial.fields?.map(createExtractionField),
});

/** 서버에서 받은(또는 녹화한) 단계 → 화면용 단계(id 붙이기) */
export const toEditableSteps = (steps: CrawlerScenarioStep[]): EditableScenarioStep[] =>
  steps.map((step) => createStep(step.type, step));

/** 화면용 단계 → 서버 요청용 단계. id를 빼고(구조 분해 후 나머지만), 대상·메모·이름 같은 칸의 앞뒤 공백을 지운다. */
export const toRequestSteps = (steps: EditableScenarioStep[]): CrawlerScenarioStep[] =>
  steps.map(({ id: _id, ...step }) => ({
    ...step,
    target: step.target.trim(),
    memo: step.memo.trim(),
    fields: step.fields?.map(({ id: _fieldId, ...field }) => ({ ...field, name: field.name.trim(), selector: field.selector.trim(), attributeName: field.attributeName.trim() })),
    // 입력값은 공백까지 그대로 보낸다(검색어 앞뒤 공백 포함).
  }));

/** 네이버 카페 검색 예시: 카페 이동 → (필요 시) 캡차 직접 처리 → 검색어 입력 → Enter → 목록 수집 */
export const createNaverCafeExampleSteps = (cafeUrl: string, keyword: string): EditableScenarioStep[] => [
  createStep("GOTO", { value: cafeUrl, memo: "카페 첫 화면" }),
  createStep("FILL", { target: "카페글 검색어 입력", value: keyword, memo: "왼쪽 카페 검색창" }),
  createStep("PRESS", { target: "카페글 검색어 입력", value: "Enter" }),
  createStep("WAIT", { value: "1500", memo: "검색 결과 로딩" }),
  createStep("COLLECT"),
];

/** 단계 입력칸 종류. 화면의 data-step-field 값과 같다. */
export type StepField = "target" | "x" | "y" | "value" | "timeoutMillis" | "name" | "attributeName";

export interface StepProblem {
  message: string;
  /** 문제가 있는 단계 id(없으면 단계 목록 전체 문제) */
  stepId?: string;
  /** 목록 반복의 하위 추출 항목 id */
  fieldId?: string;
  field?: StepField;
}

/** 대상 칸이 꼭 필요한 단계인지 (클릭·나타날 때까지 대기, 좌표 방식 제외) */
export const stepRequiresTarget = (step: CrawlerScenarioStep): boolean =>
  (step.type === "CLICK" || step.type === "WAIT_FOR" || step.type === "NEXT_PAGE") && step.targetMode !== "COORDINATE";

/** 값 칸이 꼭 필요한 단계인지 */
export const stepRequiresValue = (type: CrawlerStepType): boolean =>
  type === "GOTO" || type === "FILL" || type === "PRESS" || type === "WAIT" || type === "SCROLL";

/** 문제 없는 단계 목록인지 검사하고, 문제가 있으면 문장과 해당 입력칸을 돌려준다. */
export const validateSteps = (steps: EditableScenarioStep[]): StepProblem | null => {
  if (steps.length === 0) return { message: "단계를 한 개 이상 추가해 주세요." };
  if (steps.length > 100) return { message: "작업 단계는 최대 100개입니다." };
  for (const [index, step] of steps.entries()) {
    const number = `${index + 1}단계`;
    if (step.timeoutMillis !== null && (!Number.isInteger(step.timeoutMillis) || step.timeoutMillis < 0 || step.timeoutMillis > 600000)) {
      return { message: `${number}: 요소 대기 제한은 0~600000ms 사이 정수로 입력해 주세요.`, stepId: step.id, field: "timeoutMillis" };
    }
    if (step.type === "CSV" && (index !== steps.length - 1 || !steps.slice(0, index).some((item) => item.type === "COLLECT"))) {
      return { message: `${number}: CSV 저장은 목록 반복 뒤의 마지막 단계에 놓아 주세요.`, stepId: step.id };
    }
    if (step.type === "COLLECT" && step.fields) {
      const names = step.fields.map((field) => field.name.trim().toLowerCase());
      if (step.fields.length > 12) {
        return { message: `${number}: 추출 항목은 최대 12개입니다.`, stepId: step.id };
      }
      for (const [fieldIndex, field] of step.fields.entries()) {
        const name = names[fieldIndex];
        if (!name || name.length > 40 || !/^(?!_)[\p{L}\p{N} _-]+$/u.test(name) || names.indexOf(name) !== fieldIndex) {
          return { message: `${number}: 추출 이름은 비어 있거나 중복될 수 없으며 한글·영문·숫자·공백·_·-만 사용할 수 있습니다.`, stepId: step.id, fieldId: field.id, field: "name" };
        }
        if (field.valueSource === "ATTRIBUTE" && !field.attributeName.trim()) {
          return { message: `${number}: HTML 속성 추출에는 속성 이름을 입력해 주세요.`, stepId: step.id, fieldId: field.id, field: "attributeName" };
        }
      }
    }
    if (step.type === "SCROLL" && (!Number.isFinite(Number(step.value)) || Math.abs(Number(step.value)) > 10000)) {
      return { message: `${number}: 스크롤 거리는 -10000~10000 사이 숫자로 입력해 주세요.`, stepId: step.id, field: "value" };
    }
    if (stepRequiresValue(step.type) && !step.value.trim()) {
      return { message: `${number}: ${stepValueLabel(step.type)}을(를) 입력해 주세요.`, stepId: step.id, field: "value" };
    }
    if (step.type === "GOTO" && !/^https?:\/\//i.test(step.value.trim())) {
      return { message: `${number}: 이동할 주소를 http(s)://로 시작하게 입력해 주세요.`, stepId: step.id, field: "value" };
    }
    if (step.type === "WAIT" && (!Number.isFinite(Number(step.value)) || Number(step.value) < 0 || Number(step.value) > 600000)) {
      return { message: `${number}: 대기 시간을 숫자(ms)로 입력해 주세요.`, stepId: step.id, field: "value" };
    }
    if (stepUsesTarget(step.type) && step.targetMode === "COORDINATE" && (step.x === null || step.y === null)) {
      return { message: `${number}: 좌표 방식은 x, y를 모두 입력해 주세요.`, stepId: step.id, field: step.x === null ? "x" : "y" };
    }
    if (stepRequiresTarget(step) && !step.target.trim()) {
      return { message: `${number}: 대상(글자 또는 선택자)을 입력해 주세요.`, stepId: step.id, field: "target" };
    }
  }
  return null;
};
