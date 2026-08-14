import type { ApiWorkspaceActualRequest, ApiWorkspaceResponse, ResponseBodyView, ResponseViewerSection } from "@/features/utility/types/apiWorkspaceTypes";
import { formatByteSize, getStatusMeaning, prettyPrintResponseBody } from "@/features/utility/utils/apiWorkspaceUtils";

interface ApiWorkspaceResponseViewerProps {
  response?: ApiWorkspaceResponse;
  actualRequest?: ApiWorkspaceActualRequest;
  errorMessage?: string;
  isSending: boolean;
  activeSection: ResponseViewerSection;
  bodyView: ResponseBodyView;
  onSectionChange: (section: ResponseViewerSection) => void;
  onBodyViewChange: (bodyView: ResponseBodyView) => void;
  onCopy: () => void;
  onDownload: () => void;
}

const responseSections: Array<{ value: ResponseViewerSection; label: string }> = [
  { value: "BODY", label: "Body" }, { value: "HEADERS", label: "Headers" }, { value: "ACTUAL_REQUEST", label: "Actual Request" }, { value: "STATUS", label: "Status" },
];

export const ApiWorkspaceResponseViewer = ({ response, actualRequest, errorMessage, isSending, activeSection, bodyView, onSectionChange, onBodyViewChange, onCopy, onDownload }: ApiWorkspaceResponseViewerProps) => {
  const showingActualRequest = !isSending && Boolean(actualRequest) && activeSection === "ACTUAL_REQUEST";

  return <section className="api-response-viewer" aria-live="polite">
    <header className="api-response-heading">
      <div className="api-editor-tabs" role="tablist" aria-label="응답 정보">
        {responseSections.map((section) => <button key={section.value} type="button" role="tab" aria-selected={activeSection === section.value} className={activeSection === section.value ? "active" : undefined} onClick={() => onSectionChange(section.value)}>{section.label}{section.value === "HEADERS" && response ? <span>{response.headers.length}</span> : null}</button>)}
      </div>
      {response ? <div className="api-response-metrics"><span className={response.status < 400 ? "success" : "failure"}>{response.status} {response.statusText}</span><span>{response.elapsedMilliseconds} ms</span><span>{formatByteSize(response.sizeBytes)}</span></div> : null}
    </header>

    {isSending ? <div className="api-response-empty"><span className="api-spinner" /><strong>응답을 기다리는 중입니다.</strong><p>Cancel 버튼으로 실행 중인 요청을 취소할 수 있습니다.</p></div> : null}
    {!isSending && errorMessage && !showingActualRequest ? <div className="api-response-empty error-state"><strong>요청을 완료하지 못했습니다.</strong><p>{errorMessage}</p><small>브라우저 직접 호출은 대상 서버의 CORS 정책에 따라 차단될 수 있습니다.</small></div> : null}
    {!isSending && !response && !errorMessage && !showingActualRequest ? <div className="api-response-empty"><span>↗</span><strong>요청을 보내면 응답이 여기에 표시됩니다.</strong><p>Status, Time, Size와 응답 내용을 한 화면에서 확인할 수 있습니다.</p></div> : null}

    {!isSending && response && activeSection === "BODY" ? (
      <div className="api-response-body">
        <div className="api-response-toolbar">
          <div role="tablist" aria-label="응답 Body 보기 방식">
            {(["PRETTY", "RAW", "PREVIEW"] as ResponseBodyView[]).map((view) => <button key={view} type="button" role="tab" aria-selected={bodyView === view} className={bodyView === view ? "active" : undefined} onClick={() => onBodyViewChange(view)}>{view.charAt(0) + view.slice(1).toLowerCase()}</button>)}
          </div>
          <div><button type="button" className="ghost-button" onClick={onCopy}>복사</button><button type="button" className="ghost-button" onClick={onDownload}>다운로드</button></div>
        </div>
        {response.truncated ? <div className="api-truncated-notice">응답이 1MB를 넘어 화면에는 앞부분만 표시합니다. 전체 크기: {formatByteSize(response.sizeBytes)}</div> : null}
        {bodyView === "PRETTY" ? <pre className="api-response-code"><code>{prettyPrintResponseBody(response) || "응답 Body가 없습니다."}</code></pre> : null}
        {bodyView === "RAW" ? <textarea className="api-code-editor" value={response.body} readOnly spellCheck={false} aria-label="Raw Response Body" /> : null}
        {bodyView === "PREVIEW" ? (/html/i.test(response.contentType) ? <iframe className="api-response-preview" title="HTML 응답 미리보기" sandbox="" srcDoc={response.body} /> : <div className="api-inline-notice"><strong>Preview를 지원하지 않는 응답입니다.</strong><p>HTML 응답만 격리된 iframe에서 미리 볼 수 있습니다.</p></div>) : null}
      </div>
    ) : null}

    {showingActualRequest && actualRequest ? (
      <div className="api-actual-request">
        <div className="api-actual-request-line"><span className={`method-${actualRequest.method.toLowerCase()}`}>{actualRequest.method}</span><code>{actualRequest.url}</code></div>
        <section><header><h3>Request Headers</h3><span>{actualRequest.headers.length}</span></header><div className="api-actual-header-list">{actualRequest.headers.map((header) => <div key={header.id}><strong>{header.key}</strong><code>{header.value}</code></div>)}{actualRequest.headers.length === 0 ? <p>전송할 Header가 없습니다.</p> : null}</div></section>
        <section><header><h3>Request Body</h3><span>{actualRequest.bodyType}</span></header><pre><code>{actualRequest.body || "전송할 Body가 없습니다."}</code></pre></section>
        <small>{new Date(actualRequest.preparedAt).toLocaleString("ko-KR")}에 구성한 요청입니다. Secret 값은 마스킹했습니다.</small>
      </div>
    ) : null}

    {!isSending && response && activeSection === "HEADERS" ? <div className="api-response-header-list">{response.headers.map((header) => <div key={header.id}><strong>{header.key}</strong><code>{header.value}</code></div>)}{response.headers.length === 0 ? <p>응답 Header가 없습니다.</p> : null}</div> : null}

    {!isSending && response && activeSection === "STATUS" ? <div className="api-status-explanation"><span className={response.status < 400 ? "success" : "failure"}>{response.status}</span><div><h3>{response.statusText || "HTTP Response"}</h3><p>{getStatusMeaning(response.status)}</p><small>{new Date(response.receivedAt).toLocaleString("ko-KR")}에 응답을 받았습니다.</small></div></div> : null}
  </section>;
};
