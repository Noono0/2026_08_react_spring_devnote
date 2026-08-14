import type {
  ApiWorkspaceCollection,
  ApiWorkspaceEnvironment,
  ApiWorkspaceFolder,
  ApiWorkspaceFormDataEntry,
  ApiWorkspaceKeyValue,
  ApiWorkspaceMethod,
  ApiWorkspaceRequest,
  ApiWorkspaceSavedRequest,
} from "@/features/utility/types/apiWorkspaceTypes";
import {
  createEmptyApiRequest,
  createWorkspaceId,
  isSensitiveKey,
  sanitizeRequestForStorage,
} from "@/features/utility/utils/apiWorkspaceUtils";

export const POSTMAN_COLLECTION_SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
export const API_INTERCHANGE_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const API_INTERCHANGE_MAX_REQUESTS = 500;
const API_INTERCHANGE_MAX_ENVIRONMENT_VARIABLES = 200;

type JsonRecord = Record<string, unknown>;

export interface ImportedPostmanCollection {
  collection: ApiWorkspaceCollection;
  folders: ApiWorkspaceFolder[];
  savedRequests: ApiWorkspaceSavedRequest[];
  warnings: string[];
}

export interface ImportedPostmanEnvironment {
  environment: ApiWorkspaceEnvironment;
  warnings: string[];
}

const isRecord = (value: unknown): value is JsonRecord => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown, fallback = ""): string => typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : fallback;
const descriptionText = (value: unknown): string => typeof value === "string" ? value : isRecord(value) ? asString(value.content) : "";
const safeDecode = (value: string): string => {
  try { return decodeURIComponent(value.replace(/\+/g, " ")); } catch { return value; }
};
const uniqueWarnings = (warnings: string[]): string[] => [...new Set(warnings)];

const parseJsonDocument = (source: string): unknown => {
  if (new Blob([source]).size > API_INTERCHANGE_MAX_FILE_BYTES) throw new Error("가져올 파일은 2MB 이하여야 합니다.");
  try { return JSON.parse(source) as unknown; } catch { throw new Error("JSON 파일 문법이 올바르지 않습니다."); }
};

const createKeyValue = (key: string, value: string, enabled = true): ApiWorkspaceKeyValue => ({
  id: createWorkspaceId(),
  key,
  value,
  enabled,
  secret: isSensitiveKey(key),
});

const parseRawQuery = (rawQuery: string): ApiWorkspaceKeyValue[] => rawQuery.split("&").filter(Boolean).map((part) => {
  const separatorIndex = part.indexOf("=");
  const key = separatorIndex < 0 ? part : part.slice(0, separatorIndex);
  const value = separatorIndex < 0 ? "" : part.slice(separatorIndex + 1);
  return createKeyValue(safeDecode(key), safeDecode(value));
});

const parsePostmanUrl = (value: unknown): { url: string; params: ApiWorkspaceKeyValue[] } => {
  const urlRecord = isRecord(value) ? value : undefined;
  const rawUrl = typeof value === "string" ? value : asString(urlRecord?.raw);
  const queryIndex = rawUrl.indexOf("?");
  const baseUrl = (queryIndex >= 0 ? rawUrl.slice(0, queryIndex) : rawUrl).trim();
  const postmanQuery = asArray(urlRecord?.query);
  const params = postmanQuery.length > 0
    ? postmanQuery.filter(isRecord).map((query) => createKeyValue(asString(query.key), asString(query.value), query.disabled !== true))
    : queryIndex >= 0 ? parseRawQuery(rawUrl.slice(queryIndex + 1)) : [];
  return { url: baseUrl, params };
};

const findAuthValue = (auth: JsonRecord, field: string, key: string): string => {
  const value = asArray(auth[field]).find((entry) => isRecord(entry) && asString(entry.key) === key);
  return isRecord(value) ? asString(value.value) : "";
};

const applyPostmanAuthorization = (request: ApiWorkspaceRequest, value: unknown, warnings: string[]): void => {
  if (!isRecord(value)) return;
  const type = asString(value.type).toLocaleLowerCase();
  if (!type || type === "noauth") return;
  if (type === "bearer") {
    request.authorization = { ...request.authorization, type: "BEARER", bearerToken: findAuthValue(value, "bearer", "token") };
    return;
  }
  if (type === "basic") {
    request.authorization = { ...request.authorization, type: "BASIC", username: findAuthValue(value, "basic", "username"), password: findAuthValue(value, "basic", "password") };
    return;
  }
  if (type === "apikey") {
    request.authorization = {
      ...request.authorization,
      type: "API_KEY",
      apiKeyName: findAuthValue(value, "apikey", "key") || "X-API-Key",
      apiKeyValue: findAuthValue(value, "apikey", "value"),
      apiKeyLocation: findAuthValue(value, "apikey", "in").toLocaleLowerCase() === "query" ? "QUERY" : "HEADER",
    };
    return;
  }
  warnings.push(`지원하지 않는 Postman 인증 방식(${type})은 제외했습니다.`);
};

const parsePostmanBody = (request: ApiWorkspaceRequest, value: unknown, warnings: string[]): void => {
  if (!isRecord(value)) return;
  const mode = asString(value.mode).toLocaleLowerCase();
  if (mode === "raw") {
    request.bodyText = asString(value.raw);
    const rawOptions = isRecord(value.options) && isRecord(value.options.raw) ? value.options.raw : undefined;
    const language = asString(rawOptions?.language).toLocaleLowerCase();
    const contentType = request.headers.find((header) => header.key.toLocaleLowerCase() === "content-type")?.value.toLocaleLowerCase() ?? "";
    if (language === "json" || contentType.includes("json")) request.bodyType = "JSON";
    else {
      try { JSON.parse(request.bodyText); request.bodyType = "JSON"; } catch { request.bodyType = "TEXT"; }
    }
    return;
  }
  if (mode === "urlencoded") {
    request.bodyType = "FORM_URLENCODED";
    request.formData = asArray(value.urlencoded).filter(isRecord).map((entry) => ({
      ...createKeyValue(asString(entry.key), asString(entry.value), entry.disabled !== true),
      valueType: "TEXT",
    }));
    return;
  }
  if (mode === "formdata") {
    request.bodyType = "FORM_DATA";
    request.formData = asArray(value.formdata).filter(isRecord).map((entry): ApiWorkspaceFormDataEntry => {
      const valueType = asString(entry.type).toLocaleLowerCase() === "file" ? "FILE" : "TEXT";
      if (valueType === "FILE") warnings.push("Postman의 form-data 파일 경로는 보안상 가져오지 않았습니다. 파일을 다시 선택해 주세요.");
      return { ...createKeyValue(asString(entry.key), valueType === "TEXT" ? asString(entry.value) : "", entry.disabled !== true), valueType };
    });
    return;
  }
  if (mode) warnings.push(`지원하지 않는 Postman Body 방식(${mode})은 제외했습니다.`);
};

const supportedMethods: ApiWorkspaceMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const parsePostmanRequest = (item: JsonRecord, warnings: string[], inheritedAuthorization?: unknown): ApiWorkspaceRequest | undefined => {
  if (!isRecord(item.request)) return undefined;
  const importedRequest = item.request;
  const request = createEmptyApiRequest();
  const method = asString(importedRequest.method, "GET").toUpperCase() as ApiWorkspaceMethod;
  if (supportedMethods.includes(method)) request.method = method;
  else warnings.push(`요청 '${asString(item.name, "이름 없음")}'의 지원하지 않는 Method(${method})를 GET으로 변경했습니다.`);
  request.name = asString(item.name, "가져온 요청").trim() || "가져온 요청";
  const parsedUrl = parsePostmanUrl(importedRequest.url);
  request.url = parsedUrl.url;
  request.params = parsedUrl.params.length > 0 ? parsedUrl.params : request.params;
  const headers = asArray(importedRequest.header).filter(isRecord).map((header) => createKeyValue(asString(header.key), asString(header.value), header.disabled !== true));
  request.headers = headers.length > 0 ? headers : request.headers;
  applyPostmanAuthorization(request, importedRequest.auth ?? inheritedAuthorization, warnings);
  parsePostmanBody(request, importedRequest.body, warnings);
  return sanitizeRequestForStorage(request);
};

export const parsePostmanCollection = (source: string): ImportedPostmanCollection => {
  const document = parseJsonDocument(source);
  if (!isRecord(document) || !isRecord(document.info) || !Array.isArray(document.item)) throw new Error("Postman Collection v2.1 형식이 아닙니다.");
  const schema = asString(document.info.schema);
  if (schema && !schema.includes("collection/v2.1")) throw new Error("Postman Collection v2.1 파일만 가져올 수 있습니다.");

  const collectionId = createWorkspaceId();
  const now = new Date().toISOString();
  const collection: ApiWorkspaceCollection = {
    id: collectionId,
    name: asString(document.info.name, "가져온 Postman Collection").trim() || "가져온 Postman Collection",
    description: descriptionText(document.info.description),
    createdAt: now,
  };
  const folders: ApiWorkspaceFolder[] = [];
  const savedRequests: ApiWorkspaceSavedRequest[] = [];
  const warnings: string[] = [];

  const walkItems = (items: unknown[], parentNames: string[], folderId?: string, inheritedAuthorization?: unknown): void => {
    items.filter(isRecord).forEach((item) => {
      if (savedRequests.length >= API_INTERCHANGE_MAX_REQUESTS) return;
      if (isRecord(item.request)) {
        const request = parsePostmanRequest(item, warnings, inheritedAuthorization);
        if (!request || !request.url) { warnings.push(`URL이 없는 요청 '${asString(item.name, "이름 없음")}'은 제외했습니다.`); return; }
        const requestId = createWorkspaceId();
        savedRequests.push({
          id: requestId,
          collectionId,
          folderId,
          name: request.name,
          description: descriptionText(item.request.description) || descriptionText(item.description),
          favorite: false,
          request: { ...request, id: createWorkspaceId() },
          createdAt: now,
          updatedAt: now,
        });
        return;
      }
      if (Array.isArray(item.item)) {
        const folderPath = [...parentNames, asString(item.name, "이름 없는 Folder").trim() || "이름 없는 Folder"];
        const nextFolder: ApiWorkspaceFolder = { id: createWorkspaceId(), collectionId, name: folderPath.join(" / ").slice(0, 200) };
        folders.push(nextFolder);
        walkItems(item.item, folderPath, nextFolder.id, item.auth ?? inheritedAuthorization);
      }
    });
  };

  walkItems(document.item, [], undefined, document.auth);
  if (Array.isArray(document.variable) && document.variable.length > 0) warnings.push("Collection 변수 이름은 요청의 {{변수}} 문법에 유지했습니다. Environment에서 값을 다시 설정해 주세요.");
  if (savedRequests.length === 0) throw new Error("가져올 수 있는 HTTP 요청이 Collection에 없습니다.");
  if (savedRequests.length >= API_INTERCHANGE_MAX_REQUESTS) warnings.push(`처음 ${API_INTERCHANGE_MAX_REQUESTS}개 요청만 가져왔습니다.`);
  return { collection, folders, savedRequests, warnings: uniqueWarnings(warnings) };
};

const exportKeyValue = (entry: ApiWorkspaceKeyValue): string => isSensitiveKey(entry.key) || entry.secret ? "{{SECRET_VALUE}}" : entry.value;
const queryString = (request: ApiWorkspaceRequest): string => request.params.filter((entry) => entry.key.trim()).map((entry) => `${entry.key}=${exportKeyValue(entry)}`).join("&");

const exportPostmanAuth = (request: ApiWorkspaceRequest): JsonRecord => {
  if (request.authorization.type === "BEARER") return { type: "bearer", bearer: [{ key: "token", value: "{{ACCESS_TOKEN}}", type: "string" }] };
  if (request.authorization.type === "BASIC") return { type: "basic", basic: [{ key: "username", value: "{{BASIC_USERNAME}}", type: "string" }, { key: "password", value: "{{BASIC_PASSWORD}}", type: "string" }] };
  if (request.authorization.type === "API_KEY") return { type: "apikey", apikey: [{ key: "key", value: request.authorization.apiKeyName || "X-API-Key", type: "string" }, { key: "value", value: "{{API_KEY}}", type: "string" }, { key: "in", value: request.authorization.apiKeyLocation.toLocaleLowerCase(), type: "string" }] };
  return { type: "noauth" };
};

const exportPostmanBody = (request: ApiWorkspaceRequest): JsonRecord | undefined => {
  if (request.bodyType === "JSON" || request.bodyType === "TEXT") return { mode: "raw", raw: request.bodyText, options: { raw: { language: request.bodyType === "JSON" ? "json" : "text" } } };
  if (request.bodyType === "FORM_URLENCODED") return { mode: "urlencoded", urlencoded: request.formData.map((entry) => ({ key: entry.key, value: exportKeyValue(entry), type: "text", disabled: !entry.enabled })) };
  if (request.bodyType === "FORM_DATA") return { mode: "formdata", formdata: request.formData.map((entry) => entry.valueType === "FILE" ? { key: entry.key, type: "file", src: [], disabled: !entry.enabled } : { key: entry.key, value: exportKeyValue(entry), type: "text", disabled: !entry.enabled }) };
  return undefined;
};

const exportPostmanRequestItem = (savedRequest: ApiWorkspaceSavedRequest): JsonRecord => {
  const request = sanitizeRequestForStorage(savedRequest.request);
  const query = request.params.filter((entry) => entry.key.trim()).map((entry) => ({ key: entry.key, value: exportKeyValue(entry), disabled: !entry.enabled }));
  const querySuffix = queryString(request);
  return {
    name: savedRequest.name,
    request: {
      method: request.method,
      header: request.headers.filter((entry) => entry.key.trim()).map((entry) => ({ key: entry.key, value: exportKeyValue(entry), type: "text", disabled: !entry.enabled })),
      auth: exportPostmanAuth(request),
      body: exportPostmanBody(request),
      url: { raw: `${request.url}${querySuffix ? `${request.url.includes("?") ? "&" : "?"}${querySuffix}` : ""}`, query },
      description: savedRequest.description,
    },
  };
};

export const createPostmanCollectionJson = (
  collection: ApiWorkspaceCollection,
  folders: ApiWorkspaceFolder[],
  savedRequests: ApiWorkspaceSavedRequest[],
): string => {
  const activeRequests = savedRequests.filter((request) => request.collectionId === collection.id && !request.deletedAt);
  const folderItems = folders.filter((folder) => folder.collectionId === collection.id).map((folder) => ({
    name: folder.name,
    item: activeRequests.filter((request) => request.folderId === folder.id).map(exportPostmanRequestItem),
  })).filter((folder) => folder.item.length > 0);
  const rootItems = activeRequests.filter((request) => !request.folderId).map(exportPostmanRequestItem);
  return JSON.stringify({
    info: { _postman_id: createWorkspaceId(), name: collection.name, description: collection.description, schema: POSTMAN_COLLECTION_SCHEMA },
    item: [...folderItems, ...rootItems],
  }, null, 2);
};

export const parsePostmanEnvironment = (source: string): ImportedPostmanEnvironment => {
  const document = parseJsonDocument(source);
  if (!isRecord(document) || !Array.isArray(document.values)) throw new Error("Postman Environment JSON 형식이 아닙니다.");
  const warnings: string[] = [];
  const values = document.values.slice(0, API_INTERCHANGE_MAX_ENVIRONMENT_VARIABLES).filter(isRecord);
  if (document.values.length > API_INTERCHANGE_MAX_ENVIRONMENT_VARIABLES) warnings.push(`처음 ${API_INTERCHANGE_MAX_ENVIRONMENT_VARIABLES}개 환경변수만 가져왔습니다.`);
  const environment: ApiWorkspaceEnvironment = {
    id: createWorkspaceId(),
    name: asString(document.name, "가져온 Postman Environment").trim() || "가져온 Postman Environment",
    variables: values.map((value) => {
      const key = asString(value.key);
      return { id: createWorkspaceId(), key, value: asString(value.value), enabled: value.enabled !== false, secret: asString(value.type).toLocaleLowerCase() === "secret" || isSensitiveKey(key) };
    }),
  };
  return { environment, warnings };
};

export const createPostmanEnvironmentJson = (environment: ApiWorkspaceEnvironment): string => JSON.stringify({
  id: createWorkspaceId(),
  name: environment.name,
  values: environment.variables.map((variable) => ({ key: variable.key, value: variable.secret ? "" : variable.value, enabled: variable.enabled, type: variable.secret ? "secret" : "default" })),
  _postman_variable_scope: "environment",
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: "DevNote API Workspace",
}, null, 2);
