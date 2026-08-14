import { createEmptyApiRequest } from "@/features/utility/utils/apiWorkspaceUtils";
import { generateApiCode, parseCurlRequest } from "@/features/utility/utils/apiCodeGenerator";

describe("apiCodeGenerator", () => {
  it("Secret 원문 없이 cURL 코드를 생성한다", () => {
    const request = createEmptyApiRequest();
    request.url = "http://localhost:8080/api/v1/polls";
    request.authorization = { ...request.authorization, type: "BEARER", bearerToken: "real-token" };
    const code = generateApiCode("CURL", request);
    expect(code).toContain("{{ACCESS_TOKEN}}");
    expect(code).not.toContain("real-token");
  });

  it("cURL의 Method, Header, JSON Body를 요청으로 가져온다", () => {
    const parsed = parseCurlRequest(`curl -X POST "http://localhost/api" -H "Content-Type: application/json" -d '{"name":"DevNote"}'`);
    expect(parsed.request).toMatchObject({ method: "POST", url: "http://localhost/api", bodyType: "JSON" });
    expect(parsed.request.headers[0]?.key).toBe("Content-Type");
  });
});

