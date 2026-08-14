export type HeaderFindingSeverity = "ERROR" | "WARNING" | "INFO" | "PASS";

export interface HeaderFinding {
  id: string;
  category: "CORS" | "SECURITY" | "CACHE" | "CONTENT";
  severity: HeaderFindingSeverity;
  title: string;
  description: string;
}

export interface CorsHeaderAnalysisInput {
  requestOrigin: string;
  targetUrl: string;
  method: string;
  credentials: boolean;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
}

export interface CorsHeaderAnalysisResult {
  findings: HeaderFinding[];
  preflightExpected: boolean;
  responseHeaders: Record<string, string>;
  score: number;
}

const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.trim().toLowerCase(), value.trim()]));

export const parseRawHeaders = (source: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  let lastHeader = "";
  source.split(/\r?\n/).forEach((line) => {
    if (!line.trim() || /^HTTP\/\d/i.test(line.trim())) return;
    if (/^\s/.test(line) && lastHeader) { headers[lastHeader] = `${headers[lastHeader] ?? ""} ${line.trim()}`.trim(); return; }
    const separator = line.indexOf(":");
    if (separator <= 0) return;
    lastHeader = line.slice(0, separator).trim().toLowerCase();
    headers[lastHeader] = line.slice(separator + 1).trim();
  });
  return headers;
};

const simpleRequestHeaders = new Set(["accept", "accept-language", "content-language", "content-type", "range"]);
const simpleContentTypes = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];
const splitHeaderList = (value = ""): string[] => value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);

export const analyzeCorsAndHeaders = (input: CorsHeaderAnalysisInput): CorsHeaderAnalysisResult => {
  const requestHeaders = normalizeHeaders(input.requestHeaders);
  const responseHeaders = normalizeHeaders(input.responseHeaders);
  const method = input.method.toUpperCase();
  const nonSimpleHeaders = Object.keys(requestHeaders).filter((header) => !simpleRequestHeaders.has(header));
  const contentType = requestHeaders["content-type"]?.split(";")[0]?.trim().toLowerCase();
  const preflightExpected = !["GET", "HEAD", "POST"].includes(method) || nonSimpleHeaders.length > 0 || Boolean(contentType && !simpleContentTypes.includes(contentType));
  const findings: HeaderFinding[] = [];
  const add = (category: HeaderFinding["category"], severity: HeaderFindingSeverity, id: string, title: string, description: string): void => { findings.push({ category, severity, id, title, description }); };

  const allowOrigin = responseHeaders["access-control-allow-origin"];
  if (!allowOrigin) add("CORS", "ERROR", "cors-origin-missing", "Access-Control-Allow-Origin이 없습니다.", "다른 Origin의 브라우저 JavaScript는 응답을 읽을 수 없습니다.");
  else if (allowOrigin === "*" && input.credentials) add("CORS", "ERROR", "cors-origin-wildcard-credentials", "Credentials 요청에서 Origin *를 사용할 수 없습니다.", "쿠키 또는 인증정보를 포함하면 정확한 Origin을 반환해야 합니다.");
  else if (allowOrigin !== "*" && allowOrigin !== input.requestOrigin) add("CORS", "ERROR", "cors-origin-mismatch", "허용 Origin이 요청 Origin과 다릅니다.", `응답은 ${allowOrigin}, 요청은 ${input.requestOrigin}입니다.`);
  else add("CORS", "PASS", "cors-origin-pass", "요청 Origin을 허용합니다.", `Access-Control-Allow-Origin: ${allowOrigin}`);

  if (input.credentials) {
    if (responseHeaders["access-control-allow-credentials"]?.toLowerCase() !== "true") add("CORS", "ERROR", "cors-credentials", "Credentials 허용 Header가 없습니다.", "Access-Control-Allow-Credentials: true가 필요합니다.");
    else add("CORS", "PASS", "cors-credentials-pass", "Credentials 요청을 허용합니다.", "쿠키·HTTP 인증 응답을 브라우저에서 사용할 수 있습니다.");
  }
  if (preflightExpected) {
    const allowedMethods = splitHeaderList(responseHeaders["access-control-allow-methods"]);
    if (!allowedMethods.includes(method.toLowerCase()) && !allowedMethods.includes("*")) add("CORS", "ERROR", "cors-method", `${method} Method가 허용 목록에 없습니다.`, "OPTIONS 응답의 Access-Control-Allow-Methods를 확인하세요.");
    else add("CORS", "PASS", "cors-method-pass", `${method} Method가 허용됩니다.`, "Preflight Method 검사를 통과할 수 있습니다.");
    const allowedHeaders = splitHeaderList(responseHeaders["access-control-allow-headers"]);
    const requestedHeaderNames = Object.keys(requestHeaders).filter((header) => !simpleRequestHeaders.has(header) || header === "content-type");
    const missingHeaders = requestedHeaderNames.filter((header) => !allowedHeaders.includes(header) && !allowedHeaders.includes("*"));
    if (missingHeaders.length > 0) add("CORS", "ERROR", "cors-headers", "요청 Header가 허용 목록에 없습니다.", missingHeaders.join(", "));
    else if (requestedHeaderNames.length > 0) add("CORS", "PASS", "cors-headers-pass", "요청 Header가 허용됩니다.", requestedHeaderNames.join(", "));
    const maxAge = Number(responseHeaders["access-control-max-age"]);
    if (!Number.isFinite(maxAge) || maxAge <= 0) add("CORS", "INFO", "cors-max-age", "Preflight 결과 캐시 시간이 없습니다.", "반복 요청이 많다면 Access-Control-Max-Age를 검토할 수 있습니다.");
  } else add("CORS", "INFO", "cors-simple", "단순 요청 조건입니다.", "사용한 Method와 Header만 보면 Preflight가 필요하지 않습니다.");

  if (!responseHeaders["content-security-policy"]) add("SECURITY", "WARNING", "security-csp", "Content-Security-Policy가 없습니다.", "HTML 응답이라면 허용할 Script·Style·Frame 출처를 제한하세요.");
  else add("SECURITY", "PASS", "security-csp-pass", "Content-Security-Policy가 있습니다.", responseHeaders["content-security-policy"]);
  if (!responseHeaders["x-content-type-options"] || responseHeaders["x-content-type-options"].toLowerCase() !== "nosniff") add("SECURITY", "WARNING", "security-nosniff", "X-Content-Type-Options: nosniff가 없습니다.", "브라우저의 MIME 타입 추측을 제한할 수 있습니다.");
  else add("SECURITY", "PASS", "security-nosniff-pass", "MIME 타입 추측을 제한합니다.", "X-Content-Type-Options: nosniff");
  if (input.targetUrl.startsWith("https://") && !responseHeaders["strict-transport-security"]) add("SECURITY", "WARNING", "security-hsts", "HTTPS 응답에 HSTS가 없습니다.", "운영 HTTPS 서비스라면 Strict-Transport-Security를 검토하세요.");
  if (!responseHeaders["referrer-policy"]) add("SECURITY", "INFO", "security-referrer", "Referrer-Policy가 없습니다.", "외부 요청에 전달되는 URL 정보를 제한할 수 있습니다.");

  const responseContentType = responseHeaders["content-type"];
  if (!responseContentType) add("CONTENT", "WARNING", "content-type", "Content-Type이 없습니다.", "응답 데이터 형식과 문자 인코딩을 명시하세요.");
  else add("CONTENT", "PASS", "content-type-pass", "Content-Type이 명시되어 있습니다.", responseContentType);
  const cacheControl = responseHeaders["cache-control"];
  if (!cacheControl) add("CACHE", "INFO", "cache-control", "Cache-Control이 없습니다.", "개인정보 API는 no-store, 정적 리소스는 적절한 max-age를 검토하세요.");
  else if (input.credentials && /public/i.test(cacheControl)) add("CACHE", "WARNING", "cache-private", "Credentials 응답이 public cache로 표시됩니다.", cacheControl);
  else add("CACHE", "PASS", "cache-pass", "Cache 정책이 명시되어 있습니다.", cacheControl);

  const penalty = findings.reduce((score, finding) => score + (finding.severity === "ERROR" ? 20 : finding.severity === "WARNING" ? 8 : 0), 0);
  return { findings, preflightExpected, responseHeaders, score: Math.max(0, 100 - penalty) };
};
