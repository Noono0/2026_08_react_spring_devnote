import type { ApiWorkspaceKeyValue, ApiWorkspaceRequest } from "@/features/utility/types/apiWorkspaceTypes";
import { createEmptyApiRequest, createWorkspaceId } from "@/features/utility/utils/apiWorkspaceUtils";

export type ApiCodeTarget = "CURL" | "FETCH" | "AXIOS" | "JAVA";

const secretHeader = /authorization|cookie|api[-_ ]?key|token|secret|password/i;
const safeHeaders = (request: ApiWorkspaceRequest): Array<[string, string]> => {
  const headers = request.headers.filter((header) => header.enabled && header.key.trim()).map((header) => [header.key.trim(), secretHeader.test(header.key) || header.secret ? "{{SECRET_VALUE}}" : header.value] as [string, string]);
  if (request.authorization.type === "BEARER") headers.push(["Authorization", "Bearer {{ACCESS_TOKEN}}"]);
  if (request.authorization.type === "BASIC") headers.push(["Authorization", "Basic {{BASIC_AUTH}}"]);
  if (request.authorization.type === "API_KEY" && request.authorization.apiKeyLocation === "HEADER") headers.push([request.authorization.apiKeyName || "X-API-Key", "{{API_KEY}}"]);
  return headers;
};

const requestUrl = (request: ApiWorkspaceRequest): string => {
  const parameters = request.params.filter((parameter) => parameter.enabled && parameter.key.trim());
  if (request.authorization.type === "API_KEY" && request.authorization.apiKeyLocation === "QUERY") parameters.push({ id: "api-key", key: request.authorization.apiKeyName || "api_key", value: "{{API_KEY}}", enabled: true });
  if (parameters.length === 0) return request.url;
  const separator = request.url.includes("?") ? "&" : "?";
  return `${request.url}${separator}${parameters.map((parameter) => `${encodeURIComponent(parameter.key)}=${encodeURIComponent(parameter.secret ? "{{SECRET_VALUE}}" : parameter.value)}`).join("&")}`;
};

const bodyValue = (request: ApiWorkspaceRequest): string | undefined => {
  if (request.bodyType === "JSON" || request.bodyType === "TEXT") return request.bodyText;
  if (request.bodyType === "FORM_URLENCODED") return request.formData.filter((entry) => entry.enabled && entry.key).map((entry) => `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value)}`).join("&");
  return undefined;
};

export const generateApiCode = (target: ApiCodeTarget, request: ApiWorkspaceRequest): string => {
  const url = requestUrl(request);
  const headers = safeHeaders(request);
  const body = bodyValue(request);
  if (target === "CURL") return [
    `curl --request ${request.method} ${JSON.stringify(url)}`,
    ...headers.map(([key, value]) => `  --header ${JSON.stringify(`${key}: ${value}`)}`),
    ...(body === undefined ? [] : [`  --data-raw ${JSON.stringify(body)}`]),
  ].join(" \\\n");
  if (target === "FETCH") return `const response = await fetch(${JSON.stringify(url)}, {
  method: ${JSON.stringify(request.method)},
  headers: ${JSON.stringify(Object.fromEntries(headers), null, 2)}${body === undefined ? "" : `,\n  body: ${request.bodyType === "JSON" ? `JSON.stringify(${body || "{}"})` : JSON.stringify(body)}`}
});
const data = await response.json();`;
  if (target === "AXIOS") return `const response = await axios({
  method: ${JSON.stringify(request.method.toLowerCase())},
  url: ${JSON.stringify(url)},
  headers: ${JSON.stringify(Object.fromEntries(headers), null, 2)}${body === undefined ? "" : `,\n  data: ${request.bodyType === "JSON" ? body || "{}" : JSON.stringify(body)}`}
});`;
  return `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create(${JSON.stringify(url)}))
${headers.map(([key, value]) => `    .header(${JSON.stringify(key)}, ${JSON.stringify(value)})`).join("\n")}${headers.length ? "\n" : ""}    .method(${JSON.stringify(request.method)}, ${body === undefined ? "HttpRequest.BodyPublishers.noBody()" : `HttpRequest.BodyPublishers.ofString(${JSON.stringify(body)})`})
    .build();
HttpResponse<String> response = HttpClient.newHttpClient()
    .send(request, HttpResponse.BodyHandlers.ofString());`;
};

const tokenizeCurl = (source: string): string[] => {
  const tokens: string[] = [];
  const matcher = /"((?:\\.|[^"\\])*)"|'([^']*)'|([^\s\\]+)|\\\s*/g;
  let match = matcher.exec(source.trim());
  while (match) {
    const token = match[1] !== undefined ? match[1].replace(/\\"/g, '"') : match[2] !== undefined ? match[2] : match[3];
    if (token) tokens.push(token);
    match = matcher.exec(source.trim());
  }
  return tokens;
};

export const parseCurlRequest = (source: string): { request: ApiWorkspaceRequest; warnings: string[] } => {
  const tokens = tokenizeCurl(source);
  if (tokens[0]?.toLocaleLowerCase() !== "curl") throw new Error("cURL 명령은 curl로 시작해야 합니다.");
  const request = createEmptyApiRequest();
  const headers: ApiWorkspaceKeyValue[] = [];
  const warnings: string[] = [];
  let body: string | undefined;
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index] ?? "";
    const next = tokens[index + 1];
    if ((token === "-X" || token === "--request") && next) { request.method = next.toUpperCase() as ApiWorkspaceRequest["method"]; index += 1; }
    else if ((token === "-H" || token === "--header") && next) {
      const separator = next.indexOf(":");
      if (separator > 0) headers.push({ id: createWorkspaceId(), key: next.slice(0, separator).trim(), value: next.slice(separator + 1).trim(), enabled: true, secret: secretHeader.test(next.slice(0, separator)) });
      index += 1;
    } else if (["-d", "--data", "--data-raw", "--data-binary"].includes(token) && next !== undefined) { body = next; index += 1; }
    else if (/^https?:\/\//i.test(token)) request.url = token;
    else if (token.startsWith("-")) { warnings.push(`지원하지 않는 옵션: ${token}`); if (next && !next.startsWith("-") && !/^https?:\/\//i.test(next)) index += 1; }
  }
  if (!request.url) throw new Error("cURL 명령에서 HTTP 또는 HTTPS URL을 찾지 못했습니다.");
  request.headers = headers.length > 0 ? headers : request.headers;
  if (body !== undefined) {
    request.bodyText = body;
    try { JSON.parse(body); request.bodyType = "JSON"; } catch { request.bodyType = "TEXT"; }
    if (request.method === "GET") request.method = "POST";
  }
  return { request, warnings };
};

