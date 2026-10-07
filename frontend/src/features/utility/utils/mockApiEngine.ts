import type { ApiWorkspaceKeyValue, ApiWorkspaceRequest, ApiWorkspaceResponse } from "@/features/utility/types/apiWorkspaceTypes";
import type { MockApiResponseStep, MockApiScenario } from "@/features/utility/types/mockApiTypes";
import { createWorkspaceId, resolveEnvironmentTemplate } from "@/features/utility/utils/apiWorkspaceUtils";

// mockApiEngine.ts — 브라우저 안에서만 동작하는 "가짜 API 서버"(Mock API 시나리오 도구 + API 작업 공간의 Mock 모드)
// 시나리오(메서드 + 경로 + 응답 목록)는 localStorage에, 순서 응답(SEQUENCE)의 호출 횟수는 sessionStorage에 둔다.
// → 시나리오는 계속 남고, 호출 횟수는 탭을 닫으면 처음부터 다시 센다.
export const MOCK_API_SCENARIOS_STORAGE_KEY = "devnote-mock-api:scenarios";
const MOCK_API_COUNTERS_STORAGE_KEY = "devnote-mock-api:counters";

export const createMockApiStep = (index = 0): MockApiResponseStep => ({
  id: createWorkspaceId(), name: index === 0 ? "성공 응답" : `${index + 1}번째 응답`, status: index === 0 ? 200 : 500,
  delayMilliseconds: 0, contentType: "application/json", body: index === 0 ? '{\n  "success": true,\n  "message": "Mock API 응답입니다."\n}' : '{\n  "success": false,\n  "message": "의도한 오류입니다."\n}', headers: {}, bodyIncludes: "",
});

export const createMockApiScenario = (): MockApiScenario => {
  const now = new Date().toISOString();
  return { id: createWorkspaceId(), name: "새 Mock API", description: "", enabled: true, method: "GET", path: "/api/mock/items", mode: "FIXED", repeatSequence: true, steps: [createMockApiStep()], createdAt: now, updatedAt: now };
};

// 저장된 시나리오 목록을 읽는다. 깨진 값은 버리고 빈 목록으로 시작한다(저장 값은 믿을 수 없는 입력).
export const parseStoredMockScenarios = (value: string | null): MockApiScenario[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is MockApiScenario => item !== null && typeof item === "object" && typeof (item as MockApiScenario).id === "string" && Array.isArray((item as MockApiScenario).steps));
  } catch { return []; }
};

const parseCounters = (storage: Pick<Storage, "getItem">): Record<string, number> => {
  try {
    const value = JSON.parse(storage.getItem(MOCK_API_COUNTERS_STORAGE_KEY) ?? "{}") as unknown;
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, number> : {};
  } catch { return {}; }
};

export const resetMockApiCounters = (storage: Pick<Storage, "setItem"> = sessionStorage): void => storage.setItem(MOCK_API_COUNTERS_STORAGE_KEY, "{}");

// 이번 요청에 돌려줄 응답 고르기.
//   1. 요청 본문 조건(bodyIncludes)이 맞는 응답만 후보로, 하나도 없으면 조건 없는 응답들을 후보로
//   2. FIXED: 첫 후보 / RANDOM: 무작위 / SEQUENCE: 호출 횟수 번째(반복이면 처음부터, 아니면 마지막에 머묾)
// storage·random을 인자로 받는 이유: 테스트에서 가짜 저장소·고정 난수를 넣어 결과를 예측할 수 있게 하려는 것이다.
export const selectMockApiResponseStep = (
  scenario: MockApiScenario,
  requestBody: string,
  storage: Pick<Storage, "getItem" | "setItem"> = sessionStorage,
  random = Math.random,
): MockApiResponseStep => {
  if (scenario.steps.length === 0) throw new Error("Mock Scenario에 Response Step이 없습니다.");
  const matchedSteps = scenario.steps.filter((step) => !step.bodyIncludes || requestBody.includes(step.bodyIncludes));
  const candidates = matchedSteps.length > 0 ? matchedSteps : scenario.steps.filter((step) => !step.bodyIncludes);
  if (candidates.length === 0) throw new Error("요청 조건에 맞는 Mock Response가 없습니다.");
  if (scenario.mode === "RANDOM") return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] as MockApiResponseStep;
  if (scenario.mode === "FIXED") return candidates[0] as MockApiResponseStep;
  const counters = parseCounters(storage);
  const currentCount = Math.max(0, counters[scenario.id] ?? 0);
  const responseIndex = scenario.repeatSequence ? currentCount % candidates.length : Math.min(currentCount, candidates.length - 1);
  counters[scenario.id] = currentCount + 1;
  storage.setItem(MOCK_API_COUNTERS_STORAGE_KEY, JSON.stringify(counters));
  return candidates[responseIndex] as MockApiResponseStep;
};

// 지연 시간(최대 60초)만큼 기다린다. 사용자가 요청을 취소하면(AbortSignal) 기다리지 않고 바로 실패한다.
const waitForDelay = (milliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException("요청이 취소되었습니다.", "AbortError")); return; }
  const timer = window.setTimeout(resolve, Math.max(0, Math.min(milliseconds, 60_000)));
  signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("요청이 취소되었습니다.", "AbortError")); }, { once: true });
});

// 실제 네트워크 대신 시나리오로 응답을 만든다. 메서드와 경로가 같은 "켜진" 시나리오를 찾고, 고른 응답을 실제 응답과 같은 모양으로 돌려준다.
// 응답 헤더에 x-devnote-mock-scenario를 붙여 "가짜 응답"임을 표시한다.
export const executeMockApiRequest = async (
  request: ApiWorkspaceRequest,
  resolvedUrl: URL,
  resolvedBody: string,
  signal: AbortSignal,
  scenarioStorage: Pick<Storage, "getItem"> = localStorage,
  counterStorage: Pick<Storage, "getItem" | "setItem"> = sessionStorage,
): Promise<ApiWorkspaceResponse> => {
  const startedAt = performance.now();
  const scenarios = parseStoredMockScenarios(scenarioStorage.getItem(MOCK_API_SCENARIOS_STORAGE_KEY));
  const scenario = scenarios.find((item) => item.enabled && item.method === request.method && item.path === resolvedUrl.pathname);
  if (!scenario) throw new Error(`${request.method} ${resolvedUrl.pathname}에 해당하는 활성 Mock Scenario가 없습니다.`);
  const step = selectMockApiResponseStep(scenario, resolvedBody, counterStorage);
  await waitForDelay(step.delayMilliseconds, signal);
  const headers: ApiWorkspaceKeyValue[] = Object.entries({ "content-type": step.contentType, "x-devnote-mock-scenario": scenario.name, ...step.headers }).map(([key, value]) => ({ id: createWorkspaceId(), key, value, enabled: true }));
  const bodyBytes = new TextEncoder().encode(step.body);
  return {
    status: step.status,
    statusText: step.status >= 200 && step.status < 300 ? "Mock Success" : "Mock Response",
    elapsedMilliseconds: Math.round(performance.now() - startedAt),
    sizeBytes: bodyBytes.byteLength,
    headers,
    body: step.body,
    contentType: step.contentType,
    truncated: false,
    receivedAt: new Date().toISOString(),
    downloadBlob: new Blob([bodyBytes], { type: step.contentType }),
  };
};

// 요청 본문 안의 {{변수}}를 환경 값으로 바꾼 뒤 bodyIncludes 조건 비교에 쓴다.
export const resolveMockRequestBody = (request: ApiWorkspaceRequest, environmentValues: Array<{ key: string; value: string; enabled: boolean }>): string => {
  if (!request.bodyText) return "";
  return resolveEnvironmentTemplate(request.bodyText, environmentValues.map((item) => ({ ...item, id: item.key, secret: false }))).value;
};
