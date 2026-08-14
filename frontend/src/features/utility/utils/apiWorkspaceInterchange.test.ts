import type { ApiWorkspaceCollection, ApiWorkspaceEnvironment, ApiWorkspaceFolder, ApiWorkspaceSavedRequest } from "@/features/utility/types/apiWorkspaceTypes";
import { createEmptyApiRequest } from "@/features/utility/utils/apiWorkspaceUtils";
import {
  createPostmanCollectionJson,
  createPostmanEnvironmentJson,
  parsePostmanCollection,
  parsePostmanEnvironment,
  POSTMAN_COLLECTION_SCHEMA,
} from "@/features/utility/utils/apiWorkspaceInterchange";

describe("apiWorkspaceInterchange", () => {
  it("Postman Collection v2.1을 Collection·Folder·요청으로 가져온다", () => {
    const imported = parsePostmanCollection(JSON.stringify({
      info: { name: "결제 API", schema: POSTMAN_COLLECTION_SCHEMA },
      item: [{
        name: "주문",
        item: [{
          name: "주문 생성",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }, { key: "Authorization", value: "Bearer raw-secret" }],
            auth: { type: "bearer", bearer: [{ key: "token", value: "raw-secret" }] },
            body: { mode: "raw", raw: '{"name":"DevNote"}', options: { raw: { language: "json" } } },
            url: { raw: "{{baseUrl}}/orders?draft=true", query: [{ key: "draft", value: "true" }] },
          },
        }],
      }],
    }));

    expect(imported.collection.name).toBe("결제 API");
    expect(imported.folders).toHaveLength(1);
    expect(imported.savedRequests).toHaveLength(1);
    expect(imported.savedRequests[0]?.request).toMatchObject({ method: "POST", url: "{{baseUrl}}/orders", bodyType: "JSON" });
    expect(imported.savedRequests[0]?.request.params[0]).toMatchObject({ key: "draft", value: "true" });
    expect(imported.savedRequests[0]?.request.authorization).toMatchObject({ type: "BEARER", bearerToken: "" });
    expect(imported.savedRequests[0]?.request.headers.find((header) => header.key === "Authorization")?.value).toBe("••••••••");
  });

  it("저장 Collection을 Postman v2.1로 내보내며 Secret 원문을 제거한다", () => {
    const collection: ApiWorkspaceCollection = { id: "collection-1", name: "회원 API", description: "회원 기능", createdAt: "2026-08-14T00:00:00.000Z" };
    const folder: ApiWorkspaceFolder = { id: "folder-1", collectionId: collection.id, name: "인증" };
    const request = createEmptyApiRequest();
    request.name = "로그인";
    request.method = "POST";
    request.url = "https://api.example.com/login";
    request.headers = [{ id: "header-1", key: "X-API-Key", value: "real-secret", enabled: true, secret: true }];
    request.authorization = { ...request.authorization, type: "BEARER", bearerToken: "real-token" };
    request.bodyType = "JSON";
    request.bodyText = '{"username":"devnote","password":"body-secret"}';
    const savedRequest: ApiWorkspaceSavedRequest = { id: "request-1", collectionId: collection.id, folderId: folder.id, name: "로그인", description: "로그인 요청", favorite: false, request, createdAt: "2026-08-14T00:00:00.000Z", updatedAt: "2026-08-14T00:00:00.000Z" };

    const exported = createPostmanCollectionJson(collection, [folder], [savedRequest]);
    const document = JSON.parse(exported) as { info: { schema: string }; item: Array<{ item: Array<{ request: { header: Array<{ value: string }>; auth: { bearer: Array<{ value: string }> } } }> }> };

    expect(document.info.schema).toBe(POSTMAN_COLLECTION_SCHEMA);
    expect(document.item[0]?.item[0]?.request.header[0]?.value).toBe("{{SECRET_VALUE}}");
    expect(document.item[0]?.item[0]?.request.auth.bearer[0]?.value).toBe("{{ACCESS_TOKEN}}");
    expect(exported).not.toContain("real-secret");
    expect(exported).not.toContain("real-token");
    expect(exported).not.toContain("body-secret");
  });

  it("Postman Environment를 양방향 변환하고 Secret을 내보내지 않는다", () => {
    const environment: ApiWorkspaceEnvironment = {
      id: "environment-1",
      name: "Local",
      variables: [
        { id: "variable-1", key: "baseUrl", value: "http://localhost:8080", enabled: true, secret: false },
        { id: "variable-2", key: "accessToken", value: "real-token", enabled: true, secret: true },
      ],
    };
    const exported = createPostmanEnvironmentJson(environment);
    expect(exported).not.toContain("real-token");

    const imported = parsePostmanEnvironment(exported);
    expect(imported.environment.name).toBe("Local");
    expect(imported.environment.variables).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "baseUrl", value: "http://localhost:8080", secret: false }),
      expect.objectContaining({ key: "accessToken", value: "", secret: true }),
    ]));
  });
});
