import { analyzeOpenApiDocument, filterOpenApiOperations, parseOpenApiSource } from "@/features/utility/utils/openApiStudio";
import { importOpenApiOperationsToWorkspace } from "@/features/utility/utils/openApiWorkspaceImport";

const documentSource = {
  openapi: "3.0.3",
  info: { title: "회원 API", version: "1.0.0" },
  servers: [{ url: "http://localhost:8080" }],
  paths: {
    "/api/members/{id}": {
      get: {
        tags: ["회원"], summary: "회원 조회", operationId: "getMember",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", example: 7 } }],
        responses: { "200": { description: "성공" } },
      },
    },
    "/api/members": {
      post: {
        tags: ["회원"], summary: "회원 생성",
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, active: { type: "boolean" } } } } } },
        responses: { "201": { description: "생성" } },
      },
    },
  },
};

describe("openApiStudio", () => {
  it("OpenAPI Operation을 API Workspace 요청으로 변환한다", () => {
    const analyzed = analyzeOpenApiDocument(documentSource);
    expect(analyzed.operations).toHaveLength(2);
    expect(analyzed.operations[0]?.request.url).toBe("http://localhost:8080/api/members/7");
    expect(analyzed.operations[1]?.request.bodyText).toContain('"active": false');
    expect(filterOpenApiOperations(analyzed.operations, "회원", "GET")).toHaveLength(1);
  });

  it("JSON 문서를 파싱하고 비어 있는 paths를 거부한다", () => {
    expect(parseOpenApiSource(JSON.stringify(documentSource)).openapi).toBe("3.0.3");
    expect(() => analyzeOpenApiDocument({ openapi: "3.0.0", info: {}, paths: {} })).toThrow("paths");
  });

  it("선택한 Operation을 태그 Folder가 있는 Collection으로 저장한다", () => {
    const memory = new Map<string, string>();
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
    const analyzed = analyzeOpenApiDocument(documentSource);
    const result = importOpenApiOperationsToWorkspace("workspace", analyzed, analyzed.operations, "회원 문서", storage);
    expect(result).toMatchObject({ collectionName: "회원 문서", requestCount: 2, folderCount: 1 });
    expect(JSON.parse(memory.get("workspace:saved-requests") ?? "[]")).toHaveLength(2);
  });
});
