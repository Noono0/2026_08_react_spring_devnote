import type { ApiWorkspaceKeyValue, ApiWorkspaceRequest, ApiWorkspaceResponse } from "@/features/utility/types/apiWorkspaceTypes";
import type { MockApiResponseStep, MockApiScenario } from "@/features/utility/types/mockApiTypes";
import { createWorkspaceId, resolveEnvironmentTemplate } from "@/features/utility/utils/apiWorkspaceUtils";

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

const waitForDelay = (milliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException("요청이 취소되었습니다.", "AbortError")); return; }
  const timer = window.setTimeout(resolve, Math.max(0, Math.min(milliseconds, 60_000)));
  signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("요청이 취소되었습니다.", "AbortError")); }, { once: true });
});

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

export const resolveMockRequestBody = (request: ApiWorkspaceRequest, environmentValues: Array<{ key: string; value: string; enabled: boolean }>): string => {
  if (!request.bodyText) return "";
  return resolveEnvironmentTemplate(request.bodyText, environmentValues.map((item) => ({ ...item, id: item.key, secret: false }))).value;
};
