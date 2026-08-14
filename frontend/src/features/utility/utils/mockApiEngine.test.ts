import { createMockApiScenario, createMockApiStep, parseStoredMockScenarios, selectMockApiResponseStep } from "@/features/utility/utils/mockApiEngine";

describe("mockApiEngine", () => {
  it("순차 응답을 반복하고 호출 횟수를 저장한다", () => {
    const scenario = { ...createMockApiScenario(), mode: "SEQUENCE" as const, steps: [createMockApiStep(0), createMockApiStep(1)] };
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(selectMockApiResponseStep(scenario, "", storage).status).toBe(200);
    expect(selectMockApiResponseStep(scenario, "", storage).status).toBe(500);
    expect(selectMockApiResponseStep(scenario, "", storage).status).toBe(200);
  });

  it("Body 조건과 고정 응답을 선택한다", () => {
    const conditional = { ...createMockApiStep(0), name: "관리자", bodyIncludes: "admin", status: 201 };
    const fallback = { ...createMockApiStep(1), bodyIncludes: "", status: 400 };
    const scenario = { ...createMockApiScenario(), steps: [conditional, fallback] };
    expect(selectMockApiResponseStep(scenario, '{"role":"admin"}').status).toBe(201);
    expect(selectMockApiResponseStep(scenario, '{"role":"user"}').status).toBe(400);
    expect(parseStoredMockScenarios(JSON.stringify([scenario]))).toHaveLength(1);
  });
});
