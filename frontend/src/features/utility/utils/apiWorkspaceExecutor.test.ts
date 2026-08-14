import { afterEach, describe, expect, it, vi } from "vitest";
import { executeApiWorkspaceRequest } from "@/features/utility/utils/apiWorkspaceExecutor";
import { createEmptyApiRequest } from "@/features/utility/utils/apiWorkspaceUtils";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API Workspace 공통 요청 실행기", () => {
  it("환경변수, Query, Header와 JSON Body를 치환해 전송한다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"ok":true}', {
      status: 201,
      statusText: "Created",
      headers: { "Content-Type": "application/json", "Content-Length": "11" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const request = createEmptyApiRequest();
    request.method = "POST";
    request.url = "{{baseUrl}}/members";
    request.params = [{ id: "param", key: "page", value: "{{page}}", enabled: true }];
    request.headers = [{ id: "header", key: "X-Client", value: "{{client}}", enabled: true }];
    request.bodyType = "JSON";
    request.bodyText = '{"name":"{{name}}"}';

    const response = await executeApiWorkspaceRequest(request, [
      { id: "base", key: "baseUrl", value: "https://api.example.com", secret: false, enabled: true },
      { id: "page", key: "page", value: "2", secret: false, enabled: true },
      { id: "client", key: "client", value: "DevNote", secret: false, enabled: true },
      { id: "name", key: "name", value: "Codex", secret: false, enabled: true },
    ], new AbortController().signal);

    const [calledUrl, calledOptions] = fetchMock.mock.calls[0] ?? [];
    expect(calledUrl).toBeInstanceOf(URL);
    if (!(calledUrl instanceof URL)) throw new Error("fetch URL 인자가 필요합니다.");
    expect(calledUrl.toString()).toBe("https://api.example.com/members?page=2");
    expect((calledOptions?.headers as Headers).get("X-Client")).toBe("DevNote");
    expect(calledOptions?.body).toBe('{"name":"Codex"}');
    expect(response.status).toBe(201);
    expect(response.body).toBe('{"ok":true}');
  });
});
