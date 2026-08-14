import type {
  ApiWorkspaceEnvironmentVariable,
  ApiWorkspaceKeyValue,
  ApiWorkspaceRequest,
  ApiWorkspaceResponse,
} from "@/features/utility/types/apiWorkspaceTypes";
import {
  API_WORKSPACE_MAX_RESPONSE_BYTES,
  createWorkspaceId,
  isTextResponseContentType,
  resolveEnvironmentTemplate,
} from "@/features/utility/utils/apiWorkspaceUtils";
import { executeMockApiRequest } from "@/features/utility/utils/mockApiEngine";

const encodeBasicAuthentication = (username: string, password: string): string => {
  const encodedBytes = new TextEncoder().encode(`${username}:${password}`);
  let binaryValue = "";
  encodedBytes.forEach((byte) => { binaryValue += String.fromCharCode(byte); });
  return btoa(binaryValue);
};

const readLimitedResponse = async (response: Response): Promise<{ bytes: Uint8Array; sizeBytes: number; truncated: boolean }> => {
  const responseReader = response.body?.getReader();
  if (!responseReader) return { bytes: new Uint8Array(), sizeBytes: 0, truncated: false };

  const chunks: Uint8Array[] = [];
  let storedByteCount = 0;
  let receivedByteCount = 0;
  let truncated = false;

  while (true) {
    const readResult = await responseReader.read();
    if (readResult.done) break;
    receivedByteCount += readResult.value.byteLength;
    const remainingByteCount = API_WORKSPACE_MAX_RESPONSE_BYTES - storedByteCount;
    if (remainingByteCount > 0) {
      const storedChunk = readResult.value.slice(0, remainingByteCount);
      chunks.push(storedChunk);
      storedByteCount += storedChunk.byteLength;
    }
    if (receivedByteCount > API_WORKSPACE_MAX_RESPONSE_BYTES) {
      truncated = true;
      await responseReader.cancel("화면 표시 최대 크기를 초과했습니다.");
      break;
    }
  }

  const combinedBytes = new Uint8Array(storedByteCount);
  let writeOffset = 0;
  chunks.forEach((chunk) => {
    combinedBytes.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  });
  const contentLength = Number(response.headers.get("content-length"));
  const sizeBytes = Number.isFinite(contentLength) && contentLength > receivedByteCount ? contentLength : receivedByteCount;
  return { bytes: combinedBytes, sizeBytes, truncated };
};

/**
 * 단일 요청과 Collection Runner가 같은 전송 규칙을 사용하도록 fetch 준비 과정을 한곳에 모읍니다.
 * 실제 호출은 브라우저에서 수행되므로 대상 API의 CORS 정책이 그대로 적용됩니다.
 */
export const executeApiWorkspaceRequest = async (
  request: ApiWorkspaceRequest,
  environmentVariables: ApiWorkspaceEnvironmentVariable[],
  signal: AbortSignal,
): Promise<ApiWorkspaceResponse> => {
  const startedAt = performance.now();
  const resolveRequestValue = (value: string): string => {
    const resolution = resolveEnvironmentTemplate(value, environmentVariables);
    if (resolution.missingKeys.length > 0) throw new Error(`환경변수 값을 찾을 수 없습니다: ${resolution.missingKeys.join(", ")}`);
    if (resolution.circularKeys.length > 0) throw new Error(`환경변수가 서로 순환 참조합니다: ${resolution.circularKeys.join(", ")}`);
    return resolution.value;
  };

  const requestUrl = new URL(resolveRequestValue(request.url));
  if (!/^(?:https?|mock):$/.test(requestUrl.protocol)) throw new Error("HTTP, HTTPS 또는 mock 주소만 호출할 수 있습니다.");
  request.params
    .filter((entry) => entry.enabled && entry.key.trim())
    .forEach((entry) => requestUrl.searchParams.set(resolveRequestValue(entry.key.trim()), resolveRequestValue(entry.value)));

  const requestHeaders = new Headers();
  request.headers
    .filter((entry) => entry.enabled && entry.key.trim())
    .forEach((entry) => requestHeaders.set(resolveRequestValue(entry.key.trim()), resolveRequestValue(entry.value)));
  const authorization = request.authorization;
  if (authorization.type === "BEARER" && authorization.bearerToken) requestHeaders.set("Authorization", `Bearer ${resolveRequestValue(authorization.bearerToken)}`);
  if (authorization.type === "BASIC") requestHeaders.set("Authorization", `Basic ${encodeBasicAuthentication(resolveRequestValue(authorization.username), resolveRequestValue(authorization.password))}`);
  if (authorization.type === "API_KEY" && authorization.apiKeyName) {
    if (authorization.apiKeyLocation === "HEADER") requestHeaders.set(resolveRequestValue(authorization.apiKeyName), resolveRequestValue(authorization.apiKeyValue));
    else requestUrl.searchParams.set(resolveRequestValue(authorization.apiKeyName), resolveRequestValue(authorization.apiKeyValue));
  }

  let requestBody: BodyInit | undefined;
  let mockRequestBody = "";
  const bodyAllowed = !["GET", "HEAD"].includes(request.method);
  if (bodyAllowed && request.bodyType === "JSON") {
    try { JSON.parse(request.bodyText || "{}"); } catch { throw new Error("JSON Body 문법이 올바르지 않습니다. 전송 전에 JSON을 수정해 주세요."); }
    const resolvedJsonBody = resolveRequestValue(request.bodyText || "{}");
    try { JSON.parse(resolvedJsonBody); } catch { throw new Error("환경변수 치환 후 JSON Body 문법이 올바르지 않습니다. 문자열 변수의 따옴표와 특수문자를 확인해 주세요."); }
    requestHeaders.set("Content-Type", "application/json");
    requestBody = resolvedJsonBody;
    mockRequestBody = resolvedJsonBody;
  }
  if (bodyAllowed && request.bodyType === "TEXT") {
    requestHeaders.set("Content-Type", "text/plain;charset=UTF-8");
    requestBody = resolveRequestValue(request.bodyText);
    mockRequestBody = String(requestBody);
  }
  if (bodyAllowed && request.bodyType === "FORM_URLENCODED") {
    const formBody = new URLSearchParams();
    request.formData
      .filter((entry) => entry.enabled && entry.key)
      .forEach((entry) => formBody.set(resolveRequestValue(entry.key), resolveRequestValue(entry.value)));
    requestBody = formBody;
    mockRequestBody = formBody.toString();
  }
  if (bodyAllowed && request.bodyType === "FORM_DATA") {
    const formBody = new FormData();
    request.formData.filter((entry) => entry.enabled && entry.key).forEach((entry) => {
      const resolvedKey = resolveRequestValue(entry.key);
      if (entry.valueType === "FILE" && entry.file) formBody.append(resolvedKey, entry.file);
      else if (entry.valueType === "TEXT") formBody.append(resolvedKey, resolveRequestValue(entry.value));
    });
    requestBody = formBody;
    mockRequestBody = JSON.stringify(Object.fromEntries(Array.from(formBody.entries()).map(([key, value]) => [key, typeof value === "string" ? value : value.name])));
  }

  if (requestUrl.protocol === "mock:") return executeMockApiRequest(request, requestUrl, mockRequestBody, signal);

  const fetchResponse = await fetch(requestUrl, {
    method: request.method,
    headers: requestHeaders,
    body: requestBody,
    signal,
    credentials: "include",
  });
  const limitedResponse = await readLimitedResponse(fetchResponse);
  const contentType = fetchResponse.headers.get("content-type") ?? "application/octet-stream";
  const isTextResponse = isTextResponseContentType(contentType);
  const decodedBody = isTextResponse ? new TextDecoder().decode(limitedResponse.bytes) : "";
  const responseHeaders: ApiWorkspaceKeyValue[] = [];
  fetchResponse.headers.forEach((value, key) => responseHeaders.push({ id: createWorkspaceId(), key, value, enabled: true }));

  return {
    status: fetchResponse.status,
    statusText: fetchResponse.statusText,
    elapsedMilliseconds: Math.round(performance.now() - startedAt),
    sizeBytes: limitedResponse.sizeBytes,
    headers: responseHeaders,
    body: isTextResponse ? decodedBody : `[바이너리 응답: ${contentType}]`,
    contentType,
    truncated: limitedResponse.truncated,
    receivedAt: new Date().toISOString(),
    downloadBlob: new Blob([limitedResponse.bytes.slice().buffer], { type: contentType }),
  };
};
