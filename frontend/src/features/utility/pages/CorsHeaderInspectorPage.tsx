import { useMemo, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { analyzeCorsAndHeaders, parseRawHeaders, type HeaderFindingSeverity } from "@/features/utility/utils/corsHeaderAnalyzer";

const sampleResponseHeaders = `HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 3600
Content-Type: application/json;charset=UTF-8
Cache-Control: no-store
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin`;

const severityLabels: Record<HeaderFindingSeverity, string> = { ERROR: "오류", WARNING: "주의", INFO: "정보", PASS: "통과" };

export const CorsHeaderInspectorPage = () => {
  const [targetUrl, setTargetUrl] = useState("http://localhost:8080/api/v1/auth/session");
  const [requestOrigin, setRequestOrigin] = useState(() => window.location.origin);
  const [method, setMethod] = useState("GET");
  const [credentials, setCredentials] = useState(true);
  const [requestHeadersSource, setRequestHeadersSource] = useState("Content-Type: application/json\nAuthorization: Bearer {{token}}");
  const [responseHeadersSource, setResponseHeadersSource] = useState(sampleResponseHeaders.replace("http://localhost:3000", window.location.origin));
  const [liveStatus, setLiveStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const result = useMemo(() => analyzeCorsAndHeaders({ requestOrigin: requestOrigin.trim(), targetUrl: targetUrl.trim(), method, credentials, requestHeaders: parseRawHeaders(requestHeadersSource), responseHeaders: parseRawHeaders(responseHeadersSource) }), [credentials, method, requestHeadersSource, requestOrigin, responseHeadersSource, targetUrl]);
  const severityCounts = useMemo(() => Object.fromEntries((["ERROR", "WARNING", "INFO", "PASS"] as HeaderFindingSeverity[]).map((severity) => [severity, result.findings.filter((finding) => finding.severity === severity).length])) as Record<HeaderFindingSeverity, number>, [result.findings]);

  const sendLiveRequest = async (): Promise<void> => {
    setLoading(true); setLiveStatus("");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const requestHeaders = parseRawHeaders(requestHeadersSource);
      Object.keys(requestHeaders).forEach((key) => { if (requestHeaders[key]?.includes("{{")) delete requestHeaders[key]; });
      const bodyAllowed = !["GET", "HEAD"].includes(method);
      const response = await fetch(targetUrl, { method, headers: requestHeaders, credentials: credentials ? "include" : "omit", body: bodyAllowed ? "{}" : undefined, signal: controller.signal });
      const lines = [`HTTP ${response.status} ${response.statusText}`];
      response.headers.forEach((value, key) => lines.push(`${key}: ${value}`));
      setResponseHeadersSource(lines.join("\n"));
      setLiveStatus(`응답을 읽었습니다. HTTP ${response.status} · 브라우저에 노출된 ${lines.length - 1}개 Header`);
    } catch (error) {
      setLiveStatus(error instanceof DOMException && error.name === "AbortError" ? "요청 제한 시간 10초를 초과했습니다." : "브라우저가 응답을 읽지 못했습니다. 네트워크 오류일 수도 있지만 가장 흔한 원인은 대상 서버의 CORS 차단입니다. 개발자 도구 Console과 Network의 OPTIONS 요청을 함께 확인하세요.");
    } finally { window.clearTimeout(timeoutId); setLoading(false); }
  };

  return (
    <section className="site-page utility-workbench-page advanced-utility-page cors-inspector-page">
      <UtilityPageTitle kicker="Developer Utility · HTTP Diagnostics" title="CORS · HTTP Header Inspector" description="요청 조건과 응답 Header를 비교해 Preflight, Credentials, Cache와 기본 보안 설정을 설명합니다." onHelpOpen={() => setHelpOpen(true)} />
      <section className="advanced-panel cors-request-panel"><header><div><h2>요청 조건</h2><span>브라우저와 서버가 CORS를 판단하는 입력</span></div><button type="button" disabled={loading} onClick={() => void sendLiveRequest()}>{loading ? "요청 중" : "실제 요청 테스트"}</button></header><div className="cors-request-fields"><label className="grow-field">Target URL<input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} /></label><label>Method<select value={method} onChange={(event) => setMethod(event.target.value)}>{["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="grow-field">Request Origin<input value={requestOrigin} onChange={(event) => setRequestOrigin(event.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={credentials} onChange={(event) => setCredentials(event.target.checked)} />Credentials 포함</label></div><label><span>Request Headers</span><textarea aria-label="CORS 요청 Header" value={requestHeadersSource} spellCheck={false} onChange={(event) => setRequestHeadersSource(event.target.value)} /></label>{liveStatus ? <p className="utility-warning" role="status">{liveStatus}</p> : null}</section>
      <div className="cors-workbench-grid"><section className="advanced-panel cors-header-source"><header><div><h2>Response Headers</h2><span>Network에서 복사하거나 실제 요청으로 채웁니다.</span></div><button type="button" className="ghost-button" onClick={() => setResponseHeadersSource(sampleResponseHeaders.replace("http://localhost:3000", requestOrigin))}>예제 복원</button></header><textarea aria-label="CORS 응답 Header" value={responseHeadersSource} spellCheck={false} onChange={(event) => setResponseHeadersSource(event.target.value)} /></section><section className="advanced-panel cors-analysis-panel"><header><div><h2>분석 결과</h2><span>{result.preflightExpected ? "OPTIONS Preflight 예상" : "단순 요청 조건"}</span></div><strong className={`header-score score-${result.score >= 80 ? "good" : result.score >= 50 ? "warning" : "danger"}`}>{result.score}</strong></header><div className="finding-counts">{(["ERROR", "WARNING", "INFO", "PASS"] as HeaderFindingSeverity[]).map((severity) => <span className={`finding-${severity.toLowerCase()}`} key={severity}><strong>{severityCounts[severity]}</strong>{severityLabels[severity]}</span>)}</div><div className="header-finding-list">{result.findings.map((finding) => <article className={`finding-${finding.severity.toLowerCase()}`} key={finding.id}><span>{severityLabels[finding.severity]}</span><div><strong>{finding.title}</strong><p>{finding.description}</p><small>{finding.category}</small></div></article>)}</div></section></div>
      <section className="advanced-panel cors-header-table"><header><div><h2>정규화된 Response Header</h2><span>Header 이름은 대소문자를 구분하지 않습니다.</span></div></header><div className="compact-data-table header-table"><div><strong>Header</strong><strong>Value</strong></div>{Object.entries(result.responseHeaders).map(([key, value]) => <div key={key}><code>{key}</code><span>{value}</span></div>)}</div></section>
      <p className="utility-warning"><strong>점수 안내</strong> 학습용 체크리스트 점수이며 보안 인증 결과가 아닙니다. API 응답에는 CSP가 필요하지 않을 수 있고, Cache 정책은 데이터 성격에 맞춰 판단해야 합니다.</p>
      <UtilityHelpDialog isOpen={helpOpen} title="CORS · HTTP Header Inspector" description="브라우저가 다른 Origin의 응답을 읽을 수 있는 조건을 단계별로 확인합니다." onClose={() => setHelpOpen(false)}><article><h3>Preflight</h3><p>PUT·DELETE 같은 Method, application/json, Authorization 같은 Header가 있으면 브라우저가 실제 요청 전에 OPTIONS로 허용 범위를 확인할 수 있습니다.</p></article><article><h3>실제 요청의 한계</h3><p>CORS로 차단되면 JavaScript는 응답 Header를 읽을 수 없습니다. 이때 Network 탭의 OPTIONS 응답을 복사해 Response Headers에 붙여 넣으세요.</p></article><article><h3>Credentials</h3><p>쿠키를 포함할 때는 정확한 Allow-Origin과 Access-Control-Allow-Credentials: true가 필요하며 wildcard Origin을 사용할 수 없습니다.</p></article></UtilityHelpDialog>
    </section>
  );
};
