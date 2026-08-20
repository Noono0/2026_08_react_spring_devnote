/**
 * ============================================================================
 * openApiWorkspaceImport.ts — OpenAPI 문서를 API Workspace로 가져오기
 * ============================================================================
 *
 * OpenAPI Studio에서 고른 API들을 API Workspace의 Collection으로 저장한다.
 * 두 도구를 이어 주는 다리 역할이다.
 *
 *   OpenAPI 문서 → (분석) → API 목록 → (선택) → 이 파일 → Workspace Collection
 *
 * [저장 구조]
 *   Collection (문서 하나 = 묶음 하나)
 *     └ Folder (OpenAPI의 tag 하나 = 폴더 하나)
 *         └ SavedRequest (API 하나 = 요청 하나)
 *
 * ★ 왜 localStorage인가
 *   API Workspace는 로그인 없이도 쓸 수 있는 브라우저 전용 도구다.
 *   서버에 저장하지 않으므로 저사양 서버에 부담이 없고,
 *   요청에 담긴 값이 서버로 새어 나가지도 않는다.
 */

import type { ApiWorkspaceCollection, ApiWorkspaceFolder, ApiWorkspaceSavedRequest } from "@/features/utility/types/apiWorkspaceTypes";
import type { OpenApiDocumentSummary, OpenApiOperationSummary } from "@/features/utility/types/openApiTypes";
import { createWorkspaceId, sanitizeRequestForStorage } from "@/features/utility/utils/apiWorkspaceUtils";

/**
 * localStorage에서 배열을 안전하게 읽는다.
 *
 * ★ 저장소 값은 언제든 깨져 있을 수 있다.
 *   사용자가 개발자도구로 고쳤을 수도, 예전 버전이 다른 형식으로 저장했을 수도 있다.
 *   파싱에 실패하거나 배열이 아니면 빈 배열로 시작한다.
 *   여기서 오류를 던지면 가져오기 전체가 실패해 버린다.
 *
 * `<Value,>` 의 쉼표는 오타가 아니다.
 * .ts 파일에서는 없어도 되지만, TSX 문법과의 혼동을 피하려고 붙이는 관용구다.
 */
const parseStoredArray = <Value,>(value: string | null): Value[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as Value[] : [];
  } catch {
    return [];
  }
};

export interface OpenApiImportResult {
  collectionId: string;
  collectionName: string;
  requestCount: number;
  folderCount: number;
}

/**
 * 선택한 API들을 Workspace에 저장한다.
 *
 * ★ `storage` 를 마지막 인자로 받는 이유 (기본값 localStorage)
 *   테스트에서 진짜 localStorage 대신 가짜 객체를 넣을 수 있다.
 *   `Pick<Storage, "getItem" | "setItem">` 은 "이 두 메서드만 있으면 된다"는 뜻이라
 *   테스트용 가짜를 만들기도 쉽다.
 *   (selectedHttpClient와 같은 의존성 주입 발상이다)
 */
export const importOpenApiOperationsToWorkspace = (
  storagePrefix: string,
  document: OpenApiDocumentSummary,
  operations: OpenApiOperationSummary[],
  collectionName: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): OpenApiImportResult => {
  if (operations.length === 0) throw new Error("가져올 API를 한 개 이상 선택해 주세요.");

  // 같은 시각을 모든 항목에 쓴다. 한 번의 가져오기임을 데이터로도 알 수 있다.
  const now = new Date().toISOString();
  const collectionId = createWorkspaceId();

  const nextCollection: ApiWorkspaceCollection = {
    id: collectionId,
    // 이름을 비워 두면 문서 제목을 쓴다. 이름 없는 Collection이 생기지 않게 한다.
    name: collectionName.trim() || document.title,
    description: `${document.title} OpenAPI ${document.openApiVersion}에서 가져왔습니다.`,
    createdAt: now,
  };

  // ★ tag 기준으로 폴더를 만든다.
  //   OpenAPI의 tag는 보통 "회원", "주문"처럼 기능 묶음이라 폴더와 잘 맞는다.
  //   `new Set(...)` 으로 중복을 제거하고 `[...]` 로 다시 배열로 만든다.
  //   tag가 없는 API는 "기타"로 모은다.
  const tagNames = [...new Set(operations.map((operation) => operation.tags[0] ?? "기타"))];
  const nextFolders: ApiWorkspaceFolder[] = tagNames.map((tagName) => ({ id: createWorkspaceId(), collectionId, name: tagName }));

  const nextRequests: ApiWorkspaceSavedRequest[] = operations.map((operation) => ({
    id: createWorkspaceId(),
    collectionId,
    // 방금 만든 폴더 중 이름이 같은 것을 찾아 연결한다.
    folderId: nextFolders.find((folder) => folder.name === (operation.tags[0] ?? "기타"))?.id,
    name: operation.summary,
    // 설명이 없는 API가 많아 "GET /members" 형태로 대신 채운다.
    description: operation.description || `${operation.method} ${operation.path}`,
    favorite: false,
    // ★★ 저장 전에 반드시 민감한 값을 걸러 낸다.
    //   Authorization 헤더나 API Key가 localStorage에 원문으로 남으면
    //   XSS 한 번에 전부 털린다. 그 처리를 apiWorkspaceUtils가 담당한다.
    request: sanitizeRequestForStorage(operation.request),
    createdAt: now,
    updatedAt: now,
  }));

  // ★ 기존 데이터를 읽어 새 항목을 "덧붙여" 저장한다.
  //   그냥 setItem으로 덮어쓰면 이전에 만든 Collection이 전부 사라진다.
  //   읽기 → 펼치기 → 쓰기 순서를 지켜야 한다.
  storage.setItem(`${storagePrefix}:collections`, JSON.stringify([...parseStoredArray<ApiWorkspaceCollection>(storage.getItem(`${storagePrefix}:collections`)), nextCollection]));
  storage.setItem(`${storagePrefix}:folders`, JSON.stringify([...parseStoredArray<ApiWorkspaceFolder>(storage.getItem(`${storagePrefix}:folders`)), ...nextFolders]));
  storage.setItem(`${storagePrefix}:saved-requests`, JSON.stringify([...parseStoredArray<ApiWorkspaceSavedRequest>(storage.getItem(`${storagePrefix}:saved-requests`)), ...nextRequests]));

  // 화면에서 "N개 요청을 가져왔습니다" 안내를 띄울 수 있도록 결과를 돌려준다.
  return { collectionId, collectionName: nextCollection.name, requestCount: nextRequests.length, folderCount: nextFolders.length };
};
