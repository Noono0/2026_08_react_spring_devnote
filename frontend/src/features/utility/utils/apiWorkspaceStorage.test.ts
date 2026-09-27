import { describe, expect, it } from "vitest";
import { createApiWorkspaceTab } from "./apiWorkspaceUtils";
import { parseStoredEnvironments, parseStoredHistory, parseStoredTabs } from "./apiWorkspaceStorage";

describe("API Workspace 저장 데이터 복원", () => {
  it("잘못된 JSON, 객체, 빈 항목을 안전하게 무시한다", () => {
    for (const value of [null, "{", "{}", "[null, 1, {}]"]) {
      expect(parseStoredTabs(value)).toEqual([]);
      expect(parseStoredHistory(value)).toEqual([]);
    }
  });

  it("필수 중첩 필드가 잘못된 탭을 걸러내고 유효한 탭을 보존한다", () => {
    const tab = createApiWorkspaceTab();
    const broken = { ...tab, request: { ...tab.request, headers: null } };
    expect(parseStoredTabs(JSON.stringify([broken, tab]))).toEqual([tab]);
    expect(parseStoredTabs(JSON.stringify(Array.from({ length: 12 }, () => createApiWorkspaceTab())))).toHaveLength(8);
  });

  it("잘못된 환경변수 구조를 화면에 전달하지 않는다", () => {
    const valid = { id: "env", name: "Local", variables: [{ id: "url", key: "baseUrl", value: "http://localhost", enabled: true, secret: false }] };
    expect(parseStoredEnvironments(JSON.stringify([{ ...valid, variables: [null] }, valid]))).toEqual([valid]);
  });
});
