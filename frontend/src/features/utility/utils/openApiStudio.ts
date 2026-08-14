import type { ApiWorkspaceAuthorization, ApiWorkspaceKeyValue, ApiWorkspaceMethod, ApiWorkspaceRequest } from "@/features/utility/types/apiWorkspaceTypes";
import type { OpenApiDocumentSummary, OpenApiOperationSummary, OpenApiParameterSummary } from "@/features/utility/types/openApiTypes";
import { parseSimpleYaml } from "@/features/utility/utils/dataConverter";
import { createEmptyApiRequest, createWorkspaceId } from "@/features/utility/utils/apiWorkspaceUtils";

const supportedMethods = new Set<ApiWorkspaceMethod>(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const asRecord = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {};
const asString = (value: unknown): string => typeof value === "string" ? value : "";
const asStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const asUnknownArray = (value: unknown): unknown[] => Array.isArray(value) ? Array.from<unknown>(value) : [];

export const formatOpenApiExample = (value: unknown, fallback = ""): string => {
  if (value === undefined) return fallback;
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  try {
    return JSON.stringify(value) || fallback;
  } catch {
    return fallback;
  }
};

export const parseOpenApiSource = (source: string): Record<string, unknown> => {
  if (!source.trim()) throw new Error("OpenAPI 문서를 입력해 주세요.");
  if (new Blob([source]).size > 4 * 1024 * 1024) throw new Error("OpenAPI 문서는 4MB 이하만 처리할 수 있습니다.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (jsonError) {
    try {
      parsed = parseSimpleYaml(source);
    } catch {
      throw new Error(jsonError instanceof SyntaxError ? `JSON 또는 YAML 문법을 확인해 주세요: ${jsonError.message}` : "OpenAPI 문서를 해석할 수 없습니다.");
    }
  }
  if (!isRecord(parsed)) throw new Error("OpenAPI 문서의 최상위 값은 객체여야 합니다.");
  return parsed;
};

const resolveLocalReference = (root: Record<string, unknown>, value: unknown): unknown => {
  if (!isRecord(value) || typeof value.$ref !== "string" || !value.$ref.startsWith("#/")) return value;
  return value.$ref.slice(2).split("/").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment.replace(/~1/g, "/").replace(/~0/g, "~")];
  }, root);
};

const exampleFromSchema = (root: Record<string, unknown>, schemaValue: unknown, seenReferences = new Set<string>(), depth = 0): unknown => {
  if (depth > 7) return null;
  if (isRecord(schemaValue) && typeof schemaValue.$ref === "string") {
    if (seenReferences.has(schemaValue.$ref)) return null;
    const nextReferences = new Set(seenReferences);
    nextReferences.add(schemaValue.$ref);
    return exampleFromSchema(root, resolveLocalReference(root, schemaValue), nextReferences, depth + 1);
  }
  const schema = asRecord(schemaValue);
  if ("example" in schema) return schema.example;
  if ("default" in schema) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  const type = asString(schema.type);
  if (type === "array" || schema.items) return [exampleFromSchema(root, schema.items, seenReferences, depth + 1)];
  if (type === "object" || isRecord(schema.properties)) {
    return Object.fromEntries(Object.entries(asRecord(schema.properties)).map(([key, propertySchema]) => [key, exampleFromSchema(root, propertySchema, seenReferences, depth + 1)]));
  }
  if (type === "integer" || type === "number") return 0;
  if (type === "boolean") return false;
  if (type === "null") return null;
  if (asString(schema.format) === "date") return "2026-08-14";
  if (asString(schema.format) === "date-time") return "2026-08-14T12:00:00Z";
  if (asString(schema.format) === "email") return "user@example.com";
  if (asString(schema.format) === "uuid") return "00000000-0000-4000-8000-000000000000";
  return "string";
};

const getParameterExample = (root: Record<string, unknown>, parameter: Record<string, unknown>): unknown => {
  if ("example" in parameter) return parameter.example;
  return exampleFromSchema(root, parameter.schema);
};

const normalizeServerUrl = (serverUrl: string): string => {
  const trimmed = serverUrl.trim().replace(/\/$/, "");
  if (!trimmed) return "http://localhost:8080";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://localhost:8080${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
};

const createAuthorization = (root: Record<string, unknown>, operation: Record<string, unknown>): ApiWorkspaceAuthorization => {
  const security = Array.isArray(operation.security) ? operation.security : Array.isArray(root.security) ? root.security : [];
  const securityName = security.flatMap((requirement) => isRecord(requirement) ? Object.keys(requirement) : [])[0];
  const schemeValue = securityName ? asRecord(asRecord(asRecord(root.components).securitySchemes)[securityName]) : {};
  const scheme = asRecord(resolveLocalReference(root, schemeValue));
  const type = asString(scheme.type);
  const httpScheme = asString(scheme.scheme).toLowerCase();
  if (type === "http" && httpScheme === "bearer") return { type: "BEARER", bearerToken: "", username: "", password: "", apiKeyName: "X-API-Key", apiKeyValue: "", apiKeyLocation: "HEADER" };
  if (type === "http" && httpScheme === "basic") return { type: "BASIC", bearerToken: "", username: "", password: "", apiKeyName: "X-API-Key", apiKeyValue: "", apiKeyLocation: "HEADER" };
  if (type === "apiKey") return { type: "API_KEY", bearerToken: "", username: "", password: "", apiKeyName: asString(scheme.name) || "X-API-Key", apiKeyValue: "", apiKeyLocation: scheme.in === "query" ? "QUERY" : "HEADER" };
  return { type: "NONE", bearerToken: "", username: "", password: "", apiKeyName: "X-API-Key", apiKeyValue: "", apiKeyLocation: "HEADER" };
};

const createRequestFromOperation = (
  root: Record<string, unknown>,
  operation: Record<string, unknown>,
  method: ApiWorkspaceMethod,
  path: string,
  serverUrl: string,
  parameters: OpenApiParameterSummary[],
  requestExample: unknown,
  requestContentType?: string,
): ApiWorkspaceRequest => {
  let resolvedPath = path;
  parameters.filter((parameter) => parameter.location === "path").forEach((parameter) => {
    resolvedPath = resolvedPath.replace(`{${parameter.name}}`, encodeURIComponent(formatOpenApiExample(parameter.example, "1")));
  });
  const params: ApiWorkspaceKeyValue[] = parameters.filter((parameter) => parameter.location === "query").map((parameter) => ({
    id: createWorkspaceId(), key: parameter.name, value: formatOpenApiExample(parameter.example), enabled: parameter.required || parameter.example !== undefined,
  }));
  const headers: ApiWorkspaceKeyValue[] = parameters.filter((parameter) => parameter.location === "header").map((parameter) => ({
    id: createWorkspaceId(), key: parameter.name, value: formatOpenApiExample(parameter.example), enabled: parameter.required || parameter.example !== undefined,
  }));
  if (requestContentType) headers.push({ id: createWorkspaceId(), key: "Content-Type", value: requestContentType, enabled: true });
  const emptyRequest = createEmptyApiRequest();
  return {
    ...emptyRequest,
    name: asString(operation.summary) || asString(operation.operationId) || `${method} ${path}`,
    method,
    url: `${serverUrl}${resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`}`,
    params: params.length > 0 ? params : emptyRequest.params,
    headers: headers.length > 0 ? headers : emptyRequest.headers,
    authorization: createAuthorization(root, operation),
    bodyType: requestExample === undefined ? "NONE" : requestContentType === "text/plain" ? "TEXT" : "JSON",
    bodyText: requestExample === undefined ? "" : typeof requestExample === "string" && requestContentType === "text/plain" ? requestExample : JSON.stringify(requestExample, null, 2),
  };
};

const readParameters = (root: Record<string, unknown>, values: unknown[]): OpenApiParameterSummary[] => values.flatMap((parameterValue) => {
  const parameter = asRecord(resolveLocalReference(root, parameterValue));
  const name = asString(parameter.name);
  const location = asString(parameter.in);
  if (!name || !["path", "query", "header", "cookie"].includes(location)) return [];
  return [{
    name,
    location: location as OpenApiParameterSummary["location"],
    required: parameter.required === true || location === "path",
    description: asString(parameter.description),
    example: getParameterExample(root, parameter),
  }];
});

const readRequestExample = (root: Record<string, unknown>, operation: Record<string, unknown>): { example?: unknown; contentType?: string } => {
  const requestBody = asRecord(resolveLocalReference(root, operation.requestBody));
  const content = asRecord(requestBody.content);
  const contentType = ["application/json", "text/plain", ...Object.keys(content)].find((candidate, index, values) => values.indexOf(candidate) === index && candidate in content);
  if (!contentType) return {};
  const media = asRecord(content[contentType]);
  if ("example" in media) return { example: media.example, contentType };
  const examples = asRecord(media.examples);
  const firstExample = Object.values(examples)[0];
  if (firstExample !== undefined) {
    const resolvedExample = asRecord(resolveLocalReference(root, firstExample));
    if ("value" in resolvedExample) return { example: resolvedExample.value, contentType };
  }
  return { example: exampleFromSchema(root, media.schema), contentType };
};

export const analyzeOpenApiDocument = (source: Record<string, unknown>): OpenApiDocumentSummary => {
  const openApiVersion = asString(source.openapi);
  if (!openApiVersion) throw new Error("openapi 버전 필드가 없습니다. OpenAPI 3.x 문서인지 확인해 주세요.");
  if (!openApiVersion.startsWith("3.")) throw new Error(`OpenAPI 3.x 문서만 지원합니다. 입력 버전: ${openApiVersion}`);
  const info = asRecord(source.info);
  const paths = asRecord(source.paths);
  if (Object.keys(paths).length === 0) throw new Error("paths에 실행할 API가 없습니다.");
  const servers = Array.isArray(source.servers) ? source.servers : [];
  const serverUrl = normalizeServerUrl(asString(asRecord(servers[0]).url));
  const warnings: string[] = [];
  if (!asString(info.title)) warnings.push("info.title이 없어 기본 제목을 사용합니다.");
  if (servers.length === 0) warnings.push("servers가 없어 http://localhost:8080을 기본 주소로 사용합니다.");
  const operations: OpenApiOperationSummary[] = [];

  Object.entries(paths).forEach(([path, pathItemValue]) => {
    const pathItem = asRecord(resolveLocalReference(source, pathItemValue));
    const sharedParameters = asUnknownArray(pathItem.parameters);
    Object.entries(pathItem).forEach(([methodName, operationValue]) => {
      const method = methodName.toUpperCase() as ApiWorkspaceMethod;
      if (!supportedMethods.has(method) || !isRecord(operationValue)) return;
      const operation = operationValue;
      const parameters = readParameters(source, [...sharedParameters, ...asUnknownArray(operation.parameters)]);
      const requestBody = readRequestExample(source, operation);
      const tags = asStringArray(operation.tags);
      const request = createRequestFromOperation(source, operation, method, path, serverUrl, parameters, requestBody.example, requestBody.contentType);
      operations.push({
        id: `${method}:${path}`,
        method,
        path,
        operationId: asString(operation.operationId),
        summary: asString(operation.summary) || asString(operation.operationId) || `${method} ${path}`,
        description: asString(operation.description),
        tags: tags.length > 0 ? tags : ["기타"],
        parameters,
        requestExample: requestBody.example,
        requestContentType: requestBody.contentType,
        responseStatuses: Object.keys(asRecord(operation.responses)),
        deprecated: operation.deprecated === true,
        request,
      });
    });
  });
  if (operations.length === 0) throw new Error("지원하는 HTTP Operation을 찾지 못했습니다.");
  return {
    openApiVersion,
    title: asString(info.title) || "OpenAPI 문서",
    apiVersion: asString(info.version),
    description: asString(info.description),
    serverUrl,
    operations,
    schemaNames: Object.keys(asRecord(asRecord(source.components).schemas)),
    warnings,
    source,
  };
};

export const filterOpenApiOperations = (operations: OpenApiOperationSummary[], query: string, method: "ALL" | ApiWorkspaceMethod): OpenApiOperationSummary[] => {
  const normalizedQuery = query.trim().toLowerCase();
  return operations.filter((operation) => (method === "ALL" || operation.method === method) && (!normalizedQuery || [
    operation.path, operation.summary, operation.operationId, operation.description, ...operation.tags,
  ].some((value) => value.toLowerCase().includes(normalizedQuery))));
};
