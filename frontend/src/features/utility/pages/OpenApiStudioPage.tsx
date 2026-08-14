import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { ApiWorkspaceModuleNav } from "@/features/utility/components/ApiWorkspaceModuleNav";
import type { ApiWorkspaceMethod } from "@/features/utility/types/apiWorkspaceTypes";
import type { OpenApiDocumentSummary } from "@/features/utility/types/openApiTypes";
import { analyzeOpenApiDocument, filterOpenApiOperations, formatOpenApiExample, parseOpenApiSource } from "@/features/utility/utils/openApiStudio";
import { importOpenApiOperationsToWorkspace } from "@/features/utility/utils/openApiWorkspaceImport";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const methodOptions: Array<"ALL" | ApiWorkspaceMethod> = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const sampleDocument = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "DevNote 회원 API", version: "1.0.0", description: "OpenAPI Studio 학습용 예제" },
  servers: [{ url: "http://localhost:8080" }],
  paths: {
    "/api/v1/members": {
      get: { tags: ["회원"], summary: "회원 목록 조회", parameters: [{ name: "page", in: "query", schema: { type: "integer", example: 0 } }], responses: { "200": { description: "성공" } } },
      post: { tags: ["회원"], summary: "회원 생성", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { username: { type: "string", example: "new-member" }, grade: { type: "string", enum: ["BRONZE", "SILVER"] } } } } } }, responses: { "201": { description: "생성" }, "400": { description: "검증 실패" } } },
    },
    "/api/v1/members/{id}": { get: { tags: ["회원"], summary: "회원 상세 조회", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } }], responses: { "200": { description: "성공" }, "404": { description: "없음" } } } },
  },
}, null, 2);

export const OpenApiStudioPage = () => {
  const navigate = useNavigate();
  const sessionQuery = useAuthSessionQuery();
  const fileInputReference = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState(sampleDocument);
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentSummary, setDocumentSummary] = useState<OpenApiDocumentSummary>();
  const [selectedOperationIds, setSelectedOperationIds] = useState<Set<string>>(new Set());
  const [activeOperationId, setActiveOperationId] = useState<string>();
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<"ALL" | ApiWorkspaceMethod>("ALL");
  const [collectionName, setCollectionName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const visibleOperations = useMemo(() => filterOpenApiOperations(documentSummary?.operations ?? [], query, method), [documentSummary, method, query]);
  const activeOperation = documentSummary?.operations.find((operation) => operation.id === activeOperationId) ?? visibleOperations[0];
  const authenticatedMemberId = sessionQuery.data?.authenticated ? sessionQuery.data.memberId : undefined;

  const analyze = (nextSource = source): void => {
    try {
      const nextDocument = analyzeOpenApiDocument(parseOpenApiSource(nextSource));
      setDocumentSummary(nextDocument);
      setSelectedOperationIds(new Set(nextDocument.operations.map((operation) => operation.id)));
      setActiveOperationId(nextDocument.operations[0]?.id);
      setCollectionName(nextDocument.title);
      setErrorMessage("");
      applicationNotification.success(`${nextDocument.operations.length}개 API를 분석했습니다.`);
    } catch (error) {
      setDocumentSummary(undefined);
      setSelectedOperationIds(new Set());
      setErrorMessage(error instanceof Error ? error.message : "OpenAPI 문서를 분석하지 못했습니다.");
    }
  };

  const loadFromUrl = async (): Promise<void> => {
    if (!documentUrl.trim()) { setErrorMessage("OpenAPI 문서 URL을 입력해 주세요."); return; }
    setLoadingUrl(true); setErrorMessage("");
    try {
      const response = await fetch(documentUrl.trim(), { headers: { Accept: "application/json, application/yaml, text/yaml, */*" } });
      if (!response.ok) throw new Error(`문서를 불러오지 못했습니다. HTTP ${response.status}`);
      const text = await response.text();
      setSource(text);
      analyze(text);
    } catch (error) {
      setErrorMessage(error instanceof TypeError ? "브라우저 CORS 또는 네트워크 설정 때문에 문서를 읽지 못했습니다. 파일 또는 직접 입력을 사용해 주세요." : error instanceof Error ? error.message : "문서를 불러오지 못했습니다.");
    } finally {
      setLoadingUrl(false);
    }
  };

  const readFile = async (file?: File): Promise<void> => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setErrorMessage("OpenAPI 파일은 4MB 이하만 선택할 수 있습니다."); return; }
    const text = await file.text();
    setSource(text);
    analyze(text);
  };

  const toggleOperation = (operationId: string, selected: boolean): void => {
    setSelectedOperationIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (selected) nextIds.add(operationId); else nextIds.delete(operationId);
      return nextIds;
    });
  };

  const importCollection = (): void => {
    if (!documentSummary || !authenticatedMemberId) return;
    try {
      const selectedOperations = documentSummary.operations.filter((operation) => selectedOperationIds.has(operation.id));
      const result = importOpenApiOperationsToWorkspace(`devnote-api-workspace:member-${authenticatedMemberId}`, documentSummary, selectedOperations, collectionName);
      applicationNotification.success(`${result.collectionName} Collection을 만들었습니다.`, `${result.folderCount}개 Folder · ${result.requestCount}개 Request`);
      navigate("/utilities/api-workspace", { state: { openPanel: "COLLECTIONS", importedCollectionId: result.collectionId } });
    } catch (error) {
      applicationNotification.error("Collection을 만들지 못했습니다.", error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <section className="site-page utility-workbench-page advanced-utility-page">
      <UtilityPageTitle kicker="API Workspace · Contract Import" title="OpenAPI Studio" description="OpenAPI 3.x 문서를 검증·탐색하고 선택한 Endpoint를 API Workspace Collection으로 가져옵니다." onHelpOpen={() => setHelpOpen(true)} />
      <ApiWorkspaceModuleNav />
      <div className="advanced-tool-actions openapi-source-actions">
        <label className="grow-field">문서 URL<input value={documentUrl} placeholder="http://localhost:8080/v3/api-docs" onChange={(event) => setDocumentUrl(event.target.value)} /></label>
        <button type="button" disabled={loadingUrl} onClick={() => void loadFromUrl()}>{loadingUrl ? "불러오는 중" : "URL 불러오기"}</button>
        <button type="button" className="ghost-button" onClick={() => fileInputReference.current?.click()}>파일 선택</button>
        <input ref={fileInputReference} type="file" hidden accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml" onChange={(event) => void readFile(event.target.files?.[0])} />
        <button type="button" onClick={() => analyze()}>문서 분석</button>
        <Link className="secondary-link compact-link" to="/utilities/api-workspace">API Workspace</Link>
      </div>
      <label className="advanced-source-editor"><span>OpenAPI JSON 또는 YAML</span><textarea aria-label="OpenAPI 문서 입력" value={source} spellCheck={false} onChange={(event) => setSource(event.target.value)} /></label>
      {errorMessage ? <p className="field-error advanced-error" role="alert">{errorMessage}</p> : null}

      {documentSummary ? (
        <>
          <section className="advanced-summary-strip">
            <article><span>문서</span><strong>{documentSummary.title}</strong><small>API {documentSummary.apiVersion || "버전 없음"}</small></article>
            <article><span>OpenAPI</span><strong>{documentSummary.openApiVersion}</strong><small>{documentSummary.serverUrl}</small></article>
            <article><span>Endpoints</span><strong>{documentSummary.operations.length}</strong><small>{documentSummary.schemaNames.length}개 Schema</small></article>
            <article><span>선택</span><strong>{selectedOperationIds.size}</strong><small>Collection에 가져올 요청</small></article>
          </section>
          {documentSummary.warnings.map((warning) => <p className="utility-warning" key={warning}>{warning}</p>)}
          <div className="openapi-workbench-grid">
            <section className="advanced-panel openapi-operation-panel">
              <header><div><h2>Endpoint</h2><span>{visibleOperations.length}개 표시</span></div><label className="compact-check"><input type="checkbox" checked={visibleOperations.length > 0 && visibleOperations.every((operation) => selectedOperationIds.has(operation.id))} onChange={(event) => setSelectedOperationIds((currentIds) => {
                const nextIds = new Set(currentIds); visibleOperations.forEach((operation) => event.target.checked ? nextIds.add(operation.id) : nextIds.delete(operation.id)); return nextIds;
              })} />현재 결과 전체</label></header>
              <div className="advanced-filter-row"><input aria-label="OpenAPI Endpoint 검색" value={query} placeholder="경로, 설명, 태그 검색" onChange={(event) => setQuery(event.target.value)} /><select aria-label="OpenAPI Method 필터" value={method} onChange={(event) => setMethod(event.target.value as "ALL" | ApiWorkspaceMethod)}>{methodOptions.map((item) => <option key={item}>{item}</option>)}</select></div>
              <div className="openapi-operation-list">
                {visibleOperations.map((operation) => <article className={activeOperation?.id === operation.id ? "active" : undefined} key={operation.id}><input type="checkbox" aria-label={`${operation.summary} 선택`} checked={selectedOperationIds.has(operation.id)} onChange={(event) => toggleOperation(operation.id, event.target.checked)} /><button type="button" onClick={() => setActiveOperationId(operation.id)}><span className={`http-method method-${operation.method.toLowerCase()}`}>{operation.method}</span><span><strong>{operation.summary}</strong><small>{operation.path}</small></span>{operation.deprecated ? <em>Deprecated</em> : null}</button></article>)}
                {visibleOperations.length === 0 ? <div className="portfolio-state-panel">검색 조건에 맞는 Endpoint가 없습니다.</div> : null}
              </div>
            </section>
            <section className="advanced-panel openapi-detail-panel">
              {activeOperation ? <><header><div><span className={`http-method method-${activeOperation.method.toLowerCase()}`}>{activeOperation.method}</span><h2>{activeOperation.path}</h2></div><small>{activeOperation.tags.join(" · ")}</small></header><p>{activeOperation.description || activeOperation.summary}</p>
                <div className="advanced-detail-section"><h3>API Workspace 요청</h3><dl><div><dt>URL</dt><dd><code>{activeOperation.request.url}</code></dd></div><div><dt>인증</dt><dd>{activeOperation.request.authorization.type}</dd></div><div><dt>응답 상태</dt><dd>{activeOperation.responseStatuses.join(", ") || "정의 없음"}</dd></div></dl></div>
                <div className="advanced-detail-section"><h3>Parameters</h3>{activeOperation.parameters.length > 0 ? <div className="compact-data-table"><div><strong>위치</strong><strong>이름</strong><strong>필수</strong><strong>예제</strong></div>{activeOperation.parameters.map((parameter) => <div key={`${parameter.location}:${parameter.name}`}><span>{parameter.location}</span><code>{parameter.name}</code><span>{parameter.required ? "필수" : "선택"}</span><code>{formatOpenApiExample(parameter.example, "-")}</code></div>)}</div> : <p>정의된 Parameter가 없습니다.</p>}</div>
                <div className="advanced-detail-section"><h3>Request Body</h3><pre>{activeOperation.requestExample === undefined ? "Request Body 없음" : JSON.stringify(activeOperation.requestExample, null, 2)}</pre></div>
              </> : <div className="portfolio-state-panel">Endpoint를 선택해 주세요.</div>}
            </section>
          </div>
          <section className="advanced-import-bar"><div><strong>API Workspace Collection 만들기</strong><span>첫 번째 태그를 Folder로 사용하고 선택한 요청을 저장합니다.</span></div><input aria-label="가져올 Collection 이름" value={collectionName} onChange={(event) => setCollectionName(event.target.value)} /><button type="button" disabled={!authenticatedMemberId || selectedOperationIds.size === 0} onClick={importCollection}>선택한 {selectedOperationIds.size}개 가져오기</button>{!authenticatedMemberId ? <small>Collection 저장은 로그인 후 사용할 수 있습니다.</small> : null}</section>
        </>
      ) : <div className="portfolio-state-panel advanced-empty-state">문서를 분석하면 Endpoint 목록과 요청 예제가 표시됩니다.</div>}

      <UtilityHelpDialog isOpen={helpOpen} title="OpenAPI Studio" description="API 계약 문서를 API Workspace 실행 데이터로 변환합니다." onClose={() => setHelpOpen(false)}><article><h3>권장 입력</h3><p>Springdoc의 <code>/v3/api-docs</code> JSON을 가장 정확하게 지원합니다. URL 요청이 CORS로 막히면 JSON 파일을 선택하거나 내용을 붙여 넣으세요.</p></article><article><h3>가져오기 규칙</h3><p>첫 번째 server를 기본 URL로 사용하고 Path·Query·Header Parameter와 JSON Request Body 예제를 생성합니다. 태그별 Folder를 만들며, 인증 값은 저장하지 않습니다.</p></article><article><h3>현재 지원 범위</h3><p>OpenAPI 3.x와 로컬 <code>$ref</code>, JSON 요청 예제를 지원합니다. 콜백·링크·복잡한 polymorphism은 원문 Schema 확인이 필요합니다.</p></article></UtilityHelpDialog>
    </section>
  );
};
