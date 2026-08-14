import { describe, expect, it } from "vitest";
import { createApiWorkspaceActualRequest, createApiWorkspaceSaveDraft, createApiWorkspaceTab, createEmptyApiRequest, filterApiWorkspaceCollectionTree, findOpenApiWorkspaceTab, getStatusMeaning, resolveEnvironmentTemplate, sanitizeRequestForStorage } from "@/features/utility/utils/apiWorkspaceUtils";

describe("API Workspace 저장 정책", () => {
  it("Header, Authorization, JSON Body의 민감정보를 원문으로 저장하지 않는다", () => {
    const request = createEmptyApiRequest();
    request.headers = [
      { id: "authorization", key: "Authorization", value: "Bearer secret-token", enabled: true },
      { id: "content-type", key: "Content-Type", value: "application/json", enabled: true },
    ];
    request.authorization = {
      ...request.authorization,
      type: "BEARER",
      bearerToken: "secret-token",
      password: "secret-password",
      apiKeyValue: "secret-api-key",
    };
    request.bodyType = "JSON";
    request.bodyText = JSON.stringify({ name: "DevNote", password: "body-password", nested: { accessToken: "body-token" } });

    const storedRequest = sanitizeRequestForStorage(request);

    expect(storedRequest.headers[0]?.value).toBe("••••••••");
    expect(storedRequest.headers[1]?.value).toBe("application/json");
    expect(storedRequest.authorization.bearerToken).toBe("");
    expect(storedRequest.authorization.password).toBe("");
    expect(storedRequest.authorization.apiKeyValue).toBe("");
    expect(storedRequest.bodyText).not.toContain("body-password");
    expect(storedRequest.bodyText).not.toContain("body-token");
    expect(storedRequest.bodyText).toContain("DevNote");
  });

  it("초보자가 이해할 수 있는 상태 코드 설명을 제공한다", () => {
    expect(getStatusMeaning(401)).toContain("인증");
    expect(getStatusMeaning(404)).toContain("찾지 못했습니다");
    expect(getStatusMeaning(500)).toContain("서버 내부");
  });
});

describe("API Workspace 환경변수", () => {
  it("중첩된 환경변수를 실제 요청값으로 치환한다", () => {
    const resolution = resolveEnvironmentTemplate("{{apiUrl}}/members/{{memberId}}", [
      { id: "base", key: "baseUrl", value: "http://localhost:8080", enabled: true, secret: false },
      { id: "api", key: "apiUrl", value: "{{baseUrl}}/api/v1", enabled: true, secret: false },
      { id: "member", key: "memberId", value: "10", enabled: true, secret: false },
    ]);

    expect(resolution.value).toBe("http://localhost:8080/api/v1/members/10");
    expect(resolution.missingKeys).toEqual([]);
    expect(resolution.circularKeys).toEqual([]);
  });

  it("누락값과 순환 참조를 전송 전 오류로 구분한다", () => {
    const resolution = resolveEnvironmentTemplate("{{first}}/{{missing}}", [
      { id: "first", key: "first", value: "{{second}}", enabled: true, secret: false },
      { id: "second", key: "second", value: "{{first}}", enabled: true, secret: false },
    ]);

    expect(resolution.missingKeys).toEqual(["missing"]);
    expect(resolution.circularKeys).toEqual(expect.arrayContaining(["first", "second"]));
  });
});

describe("API Workspace 열린 탭 찾기", () => {
  it("같은 History 항목이 이미 열려 있으면 기존 탭을 찾는다", () => {
    const historyTab = { ...createApiWorkspaceTab(), historyItemId: "history-3" };
    const otherTab = createApiWorkspaceTab();

    expect(findOpenApiWorkspaceTab([otherTab, historyTab], { historyItemId: "history-3" })).toBe(historyTab);
    expect(findOpenApiWorkspaceTab([otherTab, historyTab], { historyItemId: "history-4" })).toBeUndefined();
  });

  it("같은 Saved Request가 이미 열려 있으면 기존 탭을 찾는다", () => {
    const savedRequestTab = { ...createApiWorkspaceTab(), savedRequestId: "saved-request-1" };

    expect(findOpenApiWorkspaceTab([savedRequestTab], { savedRequestId: "saved-request-1" })).toBe(savedRequestTab);
  });
});

describe("API Workspace 저장 폼", () => {
  const collection = { id: "collection-1", name: "DevNote API", description: "", createdAt: "2026-08-14T00:00:00.000Z" };

  it("새 요청은 첫 Collection을 기본값으로 사용한다", () => {
    const request = { ...createEmptyApiRequest(), name: "회원 조회" };

    expect(createApiWorkspaceSaveDraft(request, [collection])).toEqual({
      name: "회원 조회",
      description: "",
      collectionId: "collection-1",
      folderId: "",
    });
  });

  it("기존 저장 요청의 설명과 Collection, Folder를 유지한다", () => {
    const request = { ...createEmptyApiRequest(), name: "화면에서 수정한 이름" };
    const savedRequest = {
      id: "saved-request-1",
      collectionId: "collection-2",
      folderId: "folder-2",
      name: "세션 조회",
      description: "로그인 상태를 확인합니다.",
      favorite: false,
      request,
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
    };

    expect(createApiWorkspaceSaveDraft(request, [collection], savedRequest)).toEqual({
      name: "세션 조회",
      description: "로그인 상태를 확인합니다.",
      collectionId: "collection-2",
      folderId: "folder-2",
    });
  });

  it("Collection에서 만든 새 요청은 해당 Collection과 Folder를 저장 기본값으로 사용한다", () => {
    const request = createEmptyApiRequest();

    expect(createApiWorkspaceSaveDraft(request, [collection], undefined, { collectionId: "collection-2", folderId: "folder-2" })).toEqual({
      name: "",
      description: "",
      collectionId: "collection-2",
      folderId: "folder-2",
    });
  });
});

describe("API Workspace Collection 검색", () => {
  const collection = { id: "collection-1", name: "회원 API", description: "회원 도메인", createdAt: "2026-08-14T00:00:00.000Z" };
  const folder = { id: "folder-1", collectionId: collection.id, name: "인증" };
  const createSavedRequest = (id: string, name: string, url: string, deletedAt?: string) => ({
    id,
    collectionId: collection.id,
    folderId: folder.id,
    name,
    description: "",
    favorite: false,
    request: { ...createEmptyApiRequest(), name, url },
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
    deletedAt,
  });

  it("요청 이름과 URL로 Collection 트리를 검색한다", () => {
    const requests = [
      createSavedRequest("login", "로그인", "https://api.example.com/auth/login"),
      createSavedRequest("profile", "프로필", "https://api.example.com/members/me"),
    ];

    expect(filterApiWorkspaceCollectionTree([collection], [folder], requests, "members")[0]?.folders[0]?.requests.map((request) => request.id)).toEqual(["profile"]);
  });

  it("휴지통 요청은 검색 결과에서 제외한다", () => {
    const deletedRequest = createSavedRequest("deleted", "탈퇴", "https://api.example.com/members/withdraw", "2026-08-14T01:00:00.000Z");

    expect(filterApiWorkspaceCollectionTree([collection], [folder], [deletedRequest], "탈퇴")).toEqual([]);
  });
});

describe("API Workspace 실제 요청 미리보기", () => {
  it("환경변수와 Query Parameter를 치환하고 인증정보를 가린다", () => {
    const request = createEmptyApiRequest();
    request.url = "{{baseUrl}}/members";
    request.params = [{ id: "query", key: "page", value: "2", enabled: true }];
    request.authorization = { ...request.authorization, type: "BEARER", bearerToken: "secret-token" };

    const actualRequest = createApiWorkspaceActualRequest(request, [{ id: "base", key: "baseUrl", value: "https://api.example.com", enabled: true, secret: false }]);

    expect(actualRequest.url).toBe("https://api.example.com/members?page=2");
    expect(actualRequest.headers.find((header) => header.key === "Authorization")?.value).toBe("••••••••");
  });

  it("JSON Body와 Content-Type을 실제 전송 형태로 표시한다", () => {
    const request = createEmptyApiRequest();
    request.method = "POST";
    request.bodyType = "JSON";
    request.bodyText = '{"memberId":"{{memberId}}"}';

    const actualRequest = createApiWorkspaceActualRequest(request, [{ id: "member", key: "memberId", value: "10", enabled: true, secret: false }]);

    expect(actualRequest.body).toBe('{"memberId":"10"}');
    expect(actualRequest.headers.find((header) => header.key === "Content-Type")?.value).toBe("application/json");
  });
});
