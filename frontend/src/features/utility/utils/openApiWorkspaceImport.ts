import type { ApiWorkspaceCollection, ApiWorkspaceFolder, ApiWorkspaceSavedRequest } from "@/features/utility/types/apiWorkspaceTypes";
import type { OpenApiDocumentSummary, OpenApiOperationSummary } from "@/features/utility/types/openApiTypes";
import { createWorkspaceId, sanitizeRequestForStorage } from "@/features/utility/utils/apiWorkspaceUtils";

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

export const importOpenApiOperationsToWorkspace = (
  storagePrefix: string,
  document: OpenApiDocumentSummary,
  operations: OpenApiOperationSummary[],
  collectionName: string,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): OpenApiImportResult => {
  if (operations.length === 0) throw new Error("가져올 API를 한 개 이상 선택해 주세요.");
  const now = new Date().toISOString();
  const collectionId = createWorkspaceId();
  const nextCollection: ApiWorkspaceCollection = {
    id: collectionId,
    name: collectionName.trim() || document.title,
    description: `${document.title} OpenAPI ${document.openApiVersion}에서 가져왔습니다.`,
    createdAt: now,
  };
  const tagNames = [...new Set(operations.map((operation) => operation.tags[0] ?? "기타"))];
  const nextFolders: ApiWorkspaceFolder[] = tagNames.map((tagName) => ({ id: createWorkspaceId(), collectionId, name: tagName }));
  const nextRequests: ApiWorkspaceSavedRequest[] = operations.map((operation) => ({
    id: createWorkspaceId(),
    collectionId,
    folderId: nextFolders.find((folder) => folder.name === (operation.tags[0] ?? "기타"))?.id,
    name: operation.summary,
    description: operation.description || `${operation.method} ${operation.path}`,
    favorite: false,
    request: sanitizeRequestForStorage(operation.request),
    createdAt: now,
    updatedAt: now,
  }));
  storage.setItem(`${storagePrefix}:collections`, JSON.stringify([...parseStoredArray<ApiWorkspaceCollection>(storage.getItem(`${storagePrefix}:collections`)), nextCollection]));
  storage.setItem(`${storagePrefix}:folders`, JSON.stringify([...parseStoredArray<ApiWorkspaceFolder>(storage.getItem(`${storagePrefix}:folders`)), ...nextFolders]));
  storage.setItem(`${storagePrefix}:saved-requests`, JSON.stringify([...parseStoredArray<ApiWorkspaceSavedRequest>(storage.getItem(`${storagePrefix}:saved-requests`)), ...nextRequests]));
  return { collectionId, collectionName: nextCollection.name, requestCount: nextRequests.length, folderCount: nextFolders.length };
};
