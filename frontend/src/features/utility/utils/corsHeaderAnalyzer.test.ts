import { analyzeCorsAndHeaders, parseRawHeaders } from "@/features/utility/utils/corsHeaderAnalyzer";

describe("corsHeaderAnalyzer", () => {
  it("Credentials와 wildcard Origin 조합을 오류로 표시한다", () => {
    const result = analyzeCorsAndHeaders({ requestOrigin: "https://app.example.com", targetUrl: "https://api.example.com", method: "POST", credentials: true, requestHeaders: { Authorization: "Bearer token", "Content-Type": "application/json" }, responseHeaders: parseRawHeaders("Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: GET, POST\nAccess-Control-Allow-Headers: Authorization, Content-Type") });
    expect(result.preflightExpected).toBe(true);
    expect(result.findings.some((finding) => finding.id === "cors-origin-wildcard-credentials" && finding.severity === "ERROR")).toBe(true);
  });

  it("올바른 CORS와 보안 Header를 통과로 분석한다", () => {
    const headers = parseRawHeaders("Access-Control-Allow-Origin: https://app.example.com\nAccess-Control-Allow-Credentials: true\nContent-Type: application/json\nContent-Security-Policy: default-src 'self'\nX-Content-Type-Options: nosniff\nCache-Control: no-store");
    const result = analyzeCorsAndHeaders({ requestOrigin: "https://app.example.com", targetUrl: "https://api.example.com", method: "GET", credentials: true, requestHeaders: {}, responseHeaders: headers });
    expect(result.findings.some((finding) => finding.id === "cors-origin-pass")).toBe(true);
    expect(result.score).toBeGreaterThan(70);
  });
});
