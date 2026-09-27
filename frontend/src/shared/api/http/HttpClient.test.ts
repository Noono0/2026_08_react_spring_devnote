import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { AxiosHttpClient } from "./AxiosHttpClient";
import { FetchHttpClient } from "./FetchHttpClient";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";

vi.mock("@/shared/config/applicationEnvironment", () => ({
  applicationEnvironment: { VITE_API_BASE_URL: "http://localhost/api", VITE_DEVELOPMENT_MEMBER_ID: "1" },
}));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe.each([
  ["Axios", new AxiosHttpClient()],
  ["Fetch", new FetchHttpClient()],
] as const)("%s HTTP 계약", (_name, client) => {
  it.each(["get", "post", "put", "delete"] as const)("%s 요청에서 쿼리와 사용자 지정 헤더를 보존한다", async (method) => {
    server.use(http.all("http://localhost/api/echo", ({ request }) => HttpResponse.json({
      query: new URL(request.url).searchParams.get("keyword"),
      memberId: request.headers.get("X-Member-Id"),
      requestId: request.headers.get("X-Request-Id"),
    })));
    const options = {
      queryParameters: { keyword: "한글 검색" },
      requestHeaders: { "X-Member-Id": "7", "X-Request-Id": "provided-trace" },
    };
    const result = method === "post" || method === "put"
      ? await client[method]("/echo", { message: "payload" }, options)
      : await client[method]("/echo", options);

    expect(result).toEqual({ query: "한글 검색", memberId: "7", requestId: "provided-trace" });
  });

  it("시간 제한 0에서도 응답을 기다린다", async () => {
    server.use(http.get("http://localhost/api/slow", async () => {
      await delay(20);
      return HttpResponse.json({ done: true });
    }));
    await expect(client.get("/slow", { timeoutMilliseconds: 0 })).resolves.toEqual({ done: true });
  });

  it("소문자 사용자 지정 헤더도 기본값을 중복 없이 덮어쓴다", async () => {
    server.use(http.post("http://localhost/api/headers", ({ request }) => HttpResponse.json({
      memberId: request.headers.get("X-Member-Id"),
      requestId: request.headers.get("X-Request-Id"),
      contentType: request.headers.get("Content-Type"),
    })));
    await expect(client.post("/headers", { message: "payload" }, {
      requestHeaders: {
        "x-member-id": "7", "x-request-id": "provided-trace", "content-type": "application/vnd.example+json",
      },
    })).resolves.toEqual({ memberId: "7", requestId: "provided-trace", contentType: "application/vnd.example+json" });
  });

  it("시간 제한을 꺼도 호출자의 취소 신호를 따른다", async () => {
    const controller = new AbortController();
    controller.abort();
    const error: unknown = await client.get("/cancel", {
      timeoutMilliseconds: 0, abortSignal: controller.signal,
    }).catch((failure: unknown) => failure);
    expect(convertRequestErrorToProblemDetails(error).errorCode).toBe("REQUEST_CANCELLED");
  });

  it("깨진 JSON 오류 응답도 HTTP 상태를 유지한다", async () => {
    server.use(http.get("http://localhost/api/broken", () => new HttpResponse("{invalid", {
      status: 503, headers: { "Content-Type": "application/json" },
    })));
    const error: unknown = await client.get("/broken").catch((failure: unknown) => failure);
    expect(convertRequestErrorToProblemDetails(error)).toMatchObject({ status: 503, errorCode: "HTTP_503" });
  });
});
