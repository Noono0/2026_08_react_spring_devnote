import type {
  ApiWorkspaceAuthorization,
  ApiWorkspaceActualRequest,
  ApiWorkspaceCollection,
  ApiWorkspaceFormDataEntry,
  ApiWorkspaceHistoryItem,
  ApiWorkspaceEnvironmentVariable,
  ApiWorkspaceFolder,
  ApiWorkspaceKeyValue,
  ApiWorkspaceRequest,
  ApiWorkspaceResponse,
  ApiWorkspaceSavedRequest,
  ApiWorkspaceTab,
} from "@/features/utility/types/apiWorkspaceTypes";
import { createUuid } from "@/shared/lib/createUuid";

export const API_WORKSPACE_MAX_RESPONSE_BYTES = 1024 * 1024;
export const API_WORKSPACE_MAX_HISTORY_ITEMS = 100;

const sensitiveKeyPattern = /(authorization|cookie|set-cookie|api[-_]?key|password|passwd|access[-_]?token|refresh[-_]?token|client[-_]?secret|secret)/i;

export const createWorkspaceId = (): string => createUuid();

export const createEmptyKeyValue = (): ApiWorkspaceKeyValue => ({
  id: createWorkspaceId(),
  key: "",
  value: "",
  enabled: true,
});

export const createEmptyFormDataEntry = (): ApiWorkspaceFormDataEntry => ({
  ...createEmptyKeyValue(),
  valueType: "TEXT",
});

const createEmptyAuthorization = (): ApiWorkspaceAuthorization => ({
  type: "NONE",
  bearerToken: "",
  username: "",
  password: "",
  apiKeyName: "X-API-Key",
  apiKeyValue: "",
  apiKeyLocation: "HEADER",
});

export const createEmptyApiRequest = (): ApiWorkspaceRequest => ({
  id: createWorkspaceId(),
  name: "새 요청",
  method: "GET",
  url: "http://localhost:8080/api/v1/auth/session",
  params: [createEmptyKeyValue()],
  headers: [createEmptyKeyValue()],
  authorization: createEmptyAuthorization(),
  bodyType: "NONE",
  bodyText: "",
  formData: [createEmptyFormDataEntry()],
  timeoutMilliseconds: 10_000,
  privateExecution: false,
  saveResponseBody: false,
});

export const createApiWorkspaceTab = (request = createEmptyApiRequest()): ApiWorkspaceTab => ({
  id: createWorkspaceId(),
  request: { ...request, id: createWorkspaceId() },
  dirty: false,
});

export const findOpenApiWorkspaceTab = (
  tabs: ApiWorkspaceTab[],
  source: Pick<ApiWorkspaceTab, "historyItemId" | "savedRequestId">,
): ApiWorkspaceTab | undefined => tabs.find((tab) => (
  Boolean(source.historyItemId) && tab.historyItemId === source.historyItemId
) || (
  Boolean(source.savedRequestId) && tab.savedRequestId === source.savedRequestId
));

export interface ApiWorkspaceSaveDraft {
  name: string;
  description: string;
  collectionId: string;
  folderId: string;
}

export const createApiWorkspaceSaveDraft = (
  request: ApiWorkspaceRequest,
  collections: ApiWorkspaceCollection[],
  savedRequest?: ApiWorkspaceSavedRequest,
  preferredTarget?: { collectionId?: string; folderId?: string },
): ApiWorkspaceSaveDraft => ({
  name: savedRequest?.name ?? (request.name === "새 요청" ? "" : request.name),
  description: savedRequest?.description ?? "",
  collectionId: savedRequest?.collectionId ?? preferredTarget?.collectionId ?? collections[0]?.id ?? "",
  folderId: savedRequest?.folderId ?? preferredTarget?.folderId ?? "",
});

export interface ApiWorkspaceCollectionTreeFolder {
  folder: ApiWorkspaceFolder;
  requests: ApiWorkspaceSavedRequest[];
}

export interface ApiWorkspaceCollectionTreeNode {
  collection: ApiWorkspaceCollection;
  rootRequests: ApiWorkspaceSavedRequest[];
  folders: ApiWorkspaceCollectionTreeFolder[];
}

export const filterApiWorkspaceCollectionTree = (
  collections: ApiWorkspaceCollection[],
  folders: ApiWorkspaceFolder[],
  savedRequests: ApiWorkspaceSavedRequest[],
  query: string,
): ApiWorkspaceCollectionTreeNode[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const activeRequests = savedRequests.filter((savedRequest) => !savedRequest.deletedAt);
  const matchesRequest = (savedRequest: ApiWorkspaceSavedRequest): boolean => [
    savedRequest.name,
    savedRequest.description,
    savedRequest.request.method,
    savedRequest.request.url,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));

  return collections.flatMap((collection) => {
    const collectionMatches = !normalizedQuery || [collection.name, collection.description]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    const collectionRequests = activeRequests.filter((savedRequest) => savedRequest.collectionId === collection.id);
    const rootRequests = collectionRequests.filter((savedRequest) => !savedRequest.folderId && (collectionMatches || matchesRequest(savedRequest)));
    const visibleFolders = folders
      .filter((folder) => folder.collectionId === collection.id)
      .flatMap((folder) => {
        const folderMatches = collectionMatches || folder.name.toLowerCase().includes(normalizedQuery);
        const requests = collectionRequests.filter((savedRequest) => savedRequest.folderId === folder.id && (folderMatches || matchesRequest(savedRequest)));
        return folderMatches || requests.length > 0 ? [{ folder, requests }] : [];
      });

    return collectionMatches || rootRequests.length > 0 || visibleFolders.length > 0
      ? [{ collection, rootRequests, folders: visibleFolders }]
      : [];
  });
};

/**
 * 브라우저가 전송할 URL·Header·Body를 학습자가 확인할 수 있도록 미리 구성합니다.
 * 인증정보와 민감 Header는 실제 값을 노출하지 않고 마스킹합니다.
 */
export const createApiWorkspaceActualRequest = (
  request: ApiWorkspaceRequest,
  environmentVariables: ApiWorkspaceEnvironmentVariable[],
): ApiWorkspaceActualRequest => {
  const resolveValue = (value: string): string => {
    const resolution = resolveEnvironmentTemplate(value, environmentVariables);
    if (resolution.missingKeys.length > 0) throw new Error(`환경변수 값을 찾을 수 없습니다: ${resolution.missingKeys.join(", ")}`);
    if (resolution.circularKeys.length > 0) throw new Error(`환경변수가 서로 순환 참조합니다: ${resolution.circularKeys.join(", ")}`);
    return resolution.value;
  };
  const requestUrl = new URL(resolveValue(request.url));
  if (!/^(?:https?|mock):$/.test(requestUrl.protocol)) throw new Error("HTTP, HTTPS 또는 mock 주소만 호출할 수 있습니다.");
  request.params.filter((entry) => entry.enabled && entry.key.trim()).forEach((entry) => {
    const key = resolveValue(entry.key.trim());
    requestUrl.searchParams.set(key, isSensitiveKey(key) || entry.secret ? "••••••••" : resolveValue(entry.value));
  });

  const headers: ApiWorkspaceKeyValue[] = request.headers
    .filter((entry) => entry.enabled && entry.key.trim())
    .map((entry) => {
      const key = resolveValue(entry.key.trim());
      return { ...entry, key, value: isSensitiveKey(key) || entry.secret ? "••••••••" : resolveValue(entry.value) };
    });
  const setHeader = (key: string, value: string, secret = false): void => {
    const existingHeader = headers.find((header) => header.key.toLowerCase() === key.toLowerCase());
    const safeValue = secret || isSensitiveKey(key) ? "••••••••" : value;
    if (existingHeader) existingHeader.value = safeValue;
    else headers.push({ id: createWorkspaceId(), key, value: safeValue, enabled: true, secret });
  };

  if (request.authorization.type === "BEARER" && request.authorization.bearerToken) setHeader("Authorization", "Bearer ••••••••", true);
  if (request.authorization.type === "BASIC") setHeader("Authorization", "Basic ••••••••", true);
  if (request.authorization.type === "API_KEY" && request.authorization.apiKeyName) {
    const apiKeyName = resolveValue(request.authorization.apiKeyName);
    if (request.authorization.apiKeyLocation === "HEADER") setHeader(apiKeyName, "••••••••", true);
    else requestUrl.searchParams.set(apiKeyName, "••••••••");
  }

  const bodyAllowed = !["GET", "HEAD"].includes(request.method);
  let body = "";
  if (bodyAllowed && (request.bodyType === "JSON" || request.bodyType === "TEXT")) {
    body = resolveValue(request.bodyText || (request.bodyType === "JSON" ? "{}" : ""));
    if (request.bodyType === "JSON") {
      try { JSON.parse(body); } catch { throw new Error("환경변수 치환 후 JSON Body 문법이 올바르지 않습니다."); }
      setHeader("Content-Type", "application/json");
    } else setHeader("Content-Type", "text/plain;charset=UTF-8");
  }
  if (bodyAllowed && request.bodyType === "FORM_URLENCODED") {
    const formBody = new URLSearchParams();
    request.formData.filter((entry) => entry.enabled && entry.key).forEach((entry) => formBody.set(resolveValue(entry.key), isSensitiveKey(entry.key) || entry.secret ? "••••••••" : resolveValue(entry.value)));
    body = formBody.toString();
    setHeader("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
  }
  if (bodyAllowed && request.bodyType === "FORM_DATA") {
    body = request.formData.filter((entry) => entry.enabled && entry.key).map((entry) => {
      const value = entry.valueType === "FILE" ? `[파일: ${entry.file?.name ?? "선택 안 됨"}]` : isSensitiveKey(entry.key) || entry.secret ? "••••••••" : resolveValue(entry.value);
      return `${resolveValue(entry.key)} = ${value}`;
    }).join("\n");
    setHeader("Content-Type", "multipart/form-data; boundary=(브라우저 자동 생성)");
  }

  return { method: request.method, url: requestUrl.toString(), headers, body, bodyType: request.bodyType, preparedAt: new Date().toISOString() };
};

export const isSensitiveKey = (key: string): boolean => sensitiveKeyPattern.test(key.trim());

const maskKeyValues = (entries: ApiWorkspaceKeyValue[]): ApiWorkspaceKeyValue[] =>
  entries.map((entry) => ({
    ...entry,
    value: isSensitiveKey(entry.key) || entry.secret ? "••••••••" : entry.value,
    secret: isSensitiveKey(entry.key) || entry.secret,
  }));

const sanitizeJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        isSensitiveKey(key) ? "••••••••" : sanitizeJsonValue(nestedValue),
      ]),
    );
  }
  return value;
};

const sanitizeBodyText = (request: ApiWorkspaceRequest): string => {
  if (!request.bodyText) return "";
  if (request.bodyType !== "JSON") return "";
  try {
    return JSON.stringify(sanitizeJsonValue(JSON.parse(request.bodyText)), null, 2);
  } catch {
    return "";
  }
};

export const sanitizeRequestForStorage = (request: ApiWorkspaceRequest): ApiWorkspaceRequest => ({
  ...request,
  headers: maskKeyValues(request.headers),
  authorization: {
    ...request.authorization,
    bearerToken: "",
    password: "",
    apiKeyValue: "",
  },
  bodyText: sanitizeBodyText(request),
  formData: request.formData.map((entry) => ({
    ...entry,
    value: isSensitiveKey(entry.key) || entry.secret ? "••••••••" : entry.value,
    file: undefined,
  })),
});

export const serializeTabsForStorage = (tabs: ApiWorkspaceTab[]): string =>
  JSON.stringify(
    tabs.slice(0, 8).map((tab) => ({
      ...tab,
      request: sanitizeRequestForStorage(tab.request),
    })),
  );

export const parseStoredTabs = (storedValue: string | null): ApiWorkspaceTab[] => {
  if (!storedValue) return [];
  try {
    const tabs = JSON.parse(storedValue) as ApiWorkspaceTab[];
    return Array.isArray(tabs) && tabs.length > 0 ? tabs : [];
  } catch {
    return [];
  }
};

export const parseStoredHistory = (storedValue: string | null): ApiWorkspaceHistoryItem[] => {
  if (!storedValue) return [];
  try {
    const historyItems = JSON.parse(storedValue) as ApiWorkspaceHistoryItem[];
    return Array.isArray(historyItems) ? historyItems : [];
  } catch {
    return [];
  }
};

export const formatByteSize = (sizeBytes: number): string => {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
};

export const getStatusMeaning = (status: number): string => {
  if (status >= 200 && status < 300) return "요청이 정상적으로 처리되었습니다.";
  if (status >= 300 && status < 400) return "다른 위치로 이동하거나 캐시된 응답을 사용합니다.";
  if (status === 400) return "요청 형식이나 입력값을 확인해 주세요.";
  if (status === 401) return "로그인 또는 인증 정보가 필요합니다.";
  if (status === 403) return "인증됐지만 이 요청을 실행할 권한이 없습니다.";
  if (status === 404) return "요청한 API 주소나 리소스를 찾지 못했습니다.";
  if (status === 409) return "현재 데이터 상태와 요청이 충돌했습니다.";
  if (status === 429) return "너무 많은 요청을 보내 잠시 제한되었습니다.";
  if (status >= 500) return "호출한 서버 내부에서 오류가 발생했습니다.";
  return "HTTP 응답 상태를 API 문서와 함께 확인해 주세요.";
};

export const prettyPrintResponseBody = (response?: ApiWorkspaceResponse): string => {
  if (!response?.body) return "";
  if (!response.contentType.toLowerCase().includes("json")) return response.body;
  try {
    return JSON.stringify(JSON.parse(response.body), null, 2);
  } catch {
    return response.body;
  }
};

export const isTextResponseContentType = (contentType: string): boolean =>
  /(^text\/|json|xml|javascript|html|css|svg)/i.test(contentType);

export interface EnvironmentTemplateResolution {
  value: string;
  missingKeys: string[];
  circularKeys: string[];
}

/**
 * {{baseUrl}} 형태의 환경변수를 재귀적으로 치환합니다.
 * 누락값과 순환 참조를 별도로 반환해 잘못된 주소가 조용히 전송되지 않게 합니다.
 */
export const resolveEnvironmentTemplate = (
  template: string,
  variables: ApiWorkspaceEnvironmentVariable[],
): EnvironmentTemplateResolution => {
  const enabledVariables = new Map(
    variables
      .filter((variable) => variable.enabled && variable.key.trim())
      .map((variable) => [variable.key.trim(), variable.value]),
  );
  const missingKeys = new Set<string>();
  const circularKeys = new Set<string>();

  const resolveValue = (value: string, resolutionPath: string[]): string =>
    value.replace(/\{\{\s*([a-zA-Z_][\w.-]*)\s*}}/g, (placeholder, variableKey: string) => {
      if (!enabledVariables.has(variableKey)) {
        missingKeys.add(variableKey);
        return placeholder;
      }
      if (resolutionPath.includes(variableKey)) {
        resolutionPath.slice(resolutionPath.indexOf(variableKey)).forEach((key) => circularKeys.add(key));
        circularKeys.add(variableKey);
        return placeholder;
      }
      return resolveValue(enabledVariables.get(variableKey) ?? "", [...resolutionPath, variableKey]);
    });

  return {
    value: resolveValue(template, []),
    missingKeys: [...missingKeys],
    circularKeys: [...circularKeys],
  };
};
