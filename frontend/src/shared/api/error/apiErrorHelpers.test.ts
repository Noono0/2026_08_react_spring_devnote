import { describe, expect, it } from "vitest";
import { convertRequestErrorToProblemDetails, isApiErrorRetryable, normalizeHttpProblem } from "./apiErrorHelpers";

describe("HTTP 오류 설명", () => {
  it("알 수 없는 클라이언트 오류와 취소는 재시도하지 않고 일시적인 통신 오류만 재시도한다", () => {
    expect(isApiErrorRetryable(new Error("화면 처리 실패"))).toBe(false);
    expect(isApiErrorRetryable(new DOMException("취소", "AbortError"))).toBe(false);
    expect(isApiErrorRetryable(new DOMException("시간 초과", "TimeoutError"))).toBe(true);
    expect(isApiErrorRetryable(new TypeError("Failed to fetch"))).toBe(true);
    expect(isApiErrorRetryable(normalizeHttpProblem(503, "unavailable"))).toBe(true);
    expect(isApiErrorRetryable(normalizeHttpProblem(400, "bad request"))).toBe(false);
  });
  it("Axios의 CORS 일반 텍스트 응답을 빈 설명으로 버리지 않는다", () => {
    const problem = convertRequestErrorToProblemDetails({
      isAxiosError: true, response: { status: 403, data: "Invalid CORS request" },
    });
    expect(problem.errorCode).toBe("CORS_ORIGIN_REJECTED");
    expect(problem.detail).toContain("크롤링은 시작되지 않았습니다");
  });

  it("프록시 HTML은 노출하지 않고 상태와 다음 조치를 표시한다", () => {
    const problem = normalizeHttpProblem(502, "<html>upstream secret-host failed</html>");
    expect(problem.status).toBe(502);
    expect(problem.detail).toContain("백엔드");
    expect(JSON.stringify(problem)).not.toContain("secret-host");
  });

  it("fetch와 Axios 모두 구조화된 진단과 필드 오류를 보존한다", () => {
    const body = { status: 422, errorCode: "CRAWLER_LOGIN_FAILED", crawlerStage: "로그인 완료 확인", fieldErrors: [] };
    expect(convertRequestErrorToProblemDetails(new Error("실패", { cause: normalizeHttpProblem(422, body) }))).toEqual(body);
    expect(convertRequestErrorToProblemDetails({ isAxiosError: true, response: { status: 422, data: body } })).toEqual(body);
  });
});
