import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { ApiToolGuide } from "@/features/utility/components/ApiToolGuide";
import { ApiWorkspaceModuleNav } from "@/features/utility/components/ApiWorkspaceModuleNav";
import type { ApiWorkspaceMethod, ApiWorkspaceRequest, ApiWorkspaceResponse } from "@/features/utility/types/apiWorkspaceTypes";
import type { MockApiResponseStep, MockApiScenario } from "@/features/utility/types/mockApiTypes";
import { executeApiWorkspaceRequest } from "@/features/utility/utils/apiWorkspaceExecutor";
import { createApiWorkspaceTab, createEmptyApiRequest, parseStoredTabs, serializeTabsForStorage } from "@/features/utility/utils/apiWorkspaceUtils";
import { createMockApiScenario, createMockApiStep, MOCK_API_SCENARIOS_STORAGE_KEY, parseStoredMockScenarios, resetMockApiCounters } from "@/features/utility/utils/mockApiEngine";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { createUuid } from "@/shared/lib/createUuid";

const methods: ApiWorkspaceMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const createWorkspaceRequest = (scenario: MockApiScenario): ApiWorkspaceRequest => ({
  ...createEmptyApiRequest(), name: scenario.name, method: scenario.method, url: `mock://local${scenario.path.startsWith("/") ? scenario.path : `/${scenario.path}`}`,
  bodyType: ["GET", "HEAD"].includes(scenario.method) ? "NONE" : "JSON", bodyText: ["GET", "HEAD"].includes(scenario.method) ? "" : '{\n  "message": "Mock 요청"\n}',
});

export const MockApiScenarioPage = () => {
  const navigate = useNavigate();
  const sessionQuery = useAuthSessionQuery();
  const [scenarios, setScenarios] = useState<MockApiScenario[]>(() => parseStoredMockScenarios(localStorage.getItem(MOCK_API_SCENARIOS_STORAGE_KEY)));
  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => scenarios[0]?.id ?? "");
  const [testResponse, setTestResponse] = useState<ApiWorkspaceResponse>();
  const [testError, setTestError] = useState("");
  const [testing, setTesting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const activeScenario = useMemo(() => scenarios.find((scenario) => scenario.id === activeScenarioId), [activeScenarioId, scenarios]);

  useEffect(() => { localStorage.setItem(MOCK_API_SCENARIOS_STORAGE_KEY, JSON.stringify(scenarios)); }, [scenarios]);

  const updateScenario = (nextScenario: MockApiScenario): void => setScenarios((currentScenarios) => currentScenarios.map((scenario) => scenario.id === nextScenario.id ? { ...nextScenario, updatedAt: new Date().toISOString() } : scenario));
  const updateStep = (stepId: string, update: Partial<MockApiResponseStep>): void => {
    if (!activeScenario) return;
    updateScenario({ ...activeScenario, steps: activeScenario.steps.map((step) => step.id === stepId ? { ...step, ...update } : step) });
  };
  const addScenario = (): void => {
    const scenario = createMockApiScenario();
    setScenarios((currentScenarios) => [...currentScenarios, scenario]); setActiveScenarioId(scenario.id); setTestResponse(undefined); setTestError("");
  };
  const duplicateScenario = (scenario: MockApiScenario): void => {
    const now = new Date().toISOString();
    const duplicate: MockApiScenario = { ...scenario, id: createUuid(), name: `${scenario.name} 복사본`, steps: scenario.steps.map((step) => ({ ...step, id: createUuid() })), createdAt: now, updatedAt: now };
    setScenarios((currentScenarios) => [...currentScenarios, duplicate]); setActiveScenarioId(duplicate.id);
  };
  const deleteScenario = (scenarioId: string): void => {
    const remaining = scenarios.filter((scenario) => scenario.id !== scenarioId);
    setScenarios(remaining); setActiveScenarioId(remaining[0]?.id ?? ""); setTestResponse(undefined); setTestError("");
  };
  const testScenario = async (): Promise<void> => {
    if (!activeScenario) return;
    localStorage.setItem(MOCK_API_SCENARIOS_STORAGE_KEY, JSON.stringify(scenarios));
    setTesting(true); setTestResponse(undefined); setTestError("");
    try { setTestResponse(await executeApiWorkspaceRequest(createWorkspaceRequest(activeScenario), [], new AbortController().signal)); }
    catch (error) { setTestError(error instanceof Error ? error.message : "Mock 요청을 실행하지 못했습니다."); }
    finally { setTesting(false); }
  };
  const openInWorkspace = (): void => {
    if (!activeScenario) return;
    localStorage.setItem(MOCK_API_SCENARIOS_STORAGE_KEY, JSON.stringify(scenarios));
    const memberId = sessionQuery.data?.authenticated ? sessionQuery.data.memberId : undefined;
    const storagePrefix = `devnote-api-workspace:${memberId ? `member-${memberId}` : "guest"}`;
    const nextTab = createApiWorkspaceTab(createWorkspaceRequest(activeScenario));
    localStorage.setItem(`${storagePrefix}:tabs`, serializeTabsForStorage([nextTab, ...parseStoredTabs(localStorage.getItem(`${storagePrefix}:tabs`))]));
    navigate("/utilities/api-workspace");
    applicationNotification.success("API Workspace에 Mock 요청 탭을 만들었습니다.");
  };

  return (
    <section className="site-page utility-workbench-page advanced-utility-page mock-api-page">
      <UtilityPageTitle kicker="API Workspace · Local Mock" title="Mock API Scenario Builder" description="지연·오류·순차 응답을 설계하고 mock:// 요청을 API Workspace에서 실행합니다." onHelpOpen={() => setHelpOpen(true)} />
      <ApiWorkspaceModuleNav />
      <div className="mock-api-layout">
        <aside className="advanced-panel mock-scenario-list"><header><div><h2>Scenarios</h2><span>{scenarios.length}개</span></div><button type="button" aria-label="Mock Scenario 추가" onClick={addScenario}>+</button></header><div>{scenarios.map((scenario) => <article className={scenario.id === activeScenarioId ? "active" : undefined} key={scenario.id}><button type="button" onClick={() => { setActiveScenarioId(scenario.id); setTestResponse(undefined); setTestError(""); }}><span className={`http-method method-${scenario.method.toLowerCase()}`}>{scenario.method}</span><strong>{scenario.name}</strong><small>{scenario.path}</small><i className={scenario.enabled ? "enabled" : undefined}>{scenario.enabled ? "ON" : "OFF"}</i></button><div><button type="button" aria-label={`${scenario.name} 복제`} onClick={() => duplicateScenario(scenario)}>⧉</button><button type="button" aria-label={`${scenario.name} 삭제`} onClick={() => deleteScenario(scenario.id)}>×</button></div></article>)}{scenarios.length === 0 ? <div className="portfolio-state-panel">+ 버튼으로 첫 Mock API를 만들어 보세요.</div> : null}</div></aside>
        <main className="advanced-panel mock-scenario-editor">{activeScenario ? <><header className="mock-editor-heading"><div><input aria-label="Mock Scenario 이름" value={activeScenario.name} onChange={(event) => updateScenario({ ...activeScenario, name: event.target.value })} /><input aria-label="Mock Scenario 설명" value={activeScenario.description} placeholder="이 Scenario가 재현하는 상황" onChange={(event) => updateScenario({ ...activeScenario, description: event.target.value })} /></div><label className="checkbox-label"><input type="checkbox" checked={activeScenario.enabled} onChange={(event) => updateScenario({ ...activeScenario, enabled: event.target.checked })} />활성</label></header>
          <div className="mock-request-rule"><label>Method<select value={activeScenario.method} onChange={(event) => updateScenario({ ...activeScenario, method: event.target.value as ApiWorkspaceMethod })}>{methods.map((item) => <option key={item}>{item}</option>)}</select></label><label className="grow-field">Path<input value={activeScenario.path} onChange={(event) => updateScenario({ ...activeScenario, path: event.target.value.startsWith("/") ? event.target.value : `/${event.target.value}` })} /></label><label>응답 모드<select value={activeScenario.mode} onChange={(event) => updateScenario({ ...activeScenario, mode: event.target.value as MockApiScenario["mode"] })}><option value="FIXED">항상 첫 응답</option><option value="SEQUENCE">순서대로</option><option value="RANDOM">무작위</option></select></label>{activeScenario.mode === "SEQUENCE" ? <label className="checkbox-label"><input type="checkbox" checked={activeScenario.repeatSequence} onChange={(event) => updateScenario({ ...activeScenario, repeatSequence: event.target.checked })} />마지막 후 반복</label> : null}</div>
          <div className="mock-step-list"><header><div><h2>Response Steps</h2><span>Body 조건이 있는 Step을 먼저 찾고, 없으면 조건 없는 Step을 사용합니다.</span></div><button type="button" onClick={() => updateScenario({ ...activeScenario, steps: [...activeScenario.steps, createMockApiStep(activeScenario.steps.length)] })}>+ 응답 추가</button></header>{activeScenario.steps.map((step, index) => <article className="mock-step-card" key={step.id}><header><strong>{index + 1}</strong><input aria-label={`${index + 1}번째 응답 이름`} value={step.name} onChange={(event) => updateStep(step.id, { name: event.target.value })} /><button type="button" aria-label={`${index + 1}번째 응답 위로`} disabled={index === 0} onClick={() => { const next = [...activeScenario.steps]; const previous = next[index - 1]; if (!previous) return; next[index - 1] = step; next[index] = previous; updateScenario({ ...activeScenario, steps: next }); }}>↑</button><button type="button" aria-label={`${index + 1}번째 응답 아래로`} disabled={index === activeScenario.steps.length - 1} onClick={() => { const next = [...activeScenario.steps]; const following = next[index + 1]; if (!following) return; next[index + 1] = step; next[index] = following; updateScenario({ ...activeScenario, steps: next }); }}>↓</button><button type="button" aria-label={`${index + 1}번째 응답 삭제`} disabled={activeScenario.steps.length === 1} onClick={() => updateScenario({ ...activeScenario, steps: activeScenario.steps.filter((item) => item.id !== step.id) })}>×</button></header><div className="mock-step-options"><label>Status<input type="number" min={100} max={599} value={step.status} onChange={(event) => updateStep(step.id, { status: Number(event.target.value) })} /></label><label>Delay(ms)<input type="number" min={0} max={60000} value={step.delayMilliseconds} onChange={(event) => updateStep(step.id, { delayMilliseconds: Number(event.target.value) })} /></label><label>Content-Type<input value={step.contentType} onChange={(event) => updateStep(step.id, { contentType: event.target.value })} /></label><label>Body 포함 조건<input value={step.bodyIncludes} placeholder="비우면 기본 응답" onChange={(event) => updateStep(step.id, { bodyIncludes: event.target.value })} /></label></div><label><span>Response Body</span><textarea aria-label={`${index + 1}번째 응답 Body`} value={step.body} spellCheck={false} onChange={(event) => updateStep(step.id, { body: event.target.value })} /></label></article>)}</div>
          <div className="advanced-import-bar mock-test-actions"><div><strong>{activeScenario.method} mock://local{activeScenario.path}</strong><span>API Workspace 전송 코드와 동일한 실행기를 사용합니다.</span></div><button type="button" className="ghost-button" onClick={() => { resetMockApiCounters(); applicationNotification.success("순차 응답 횟수를 초기화했습니다."); }}>순서 초기화</button><button type="button" disabled={testing || !activeScenario.enabled} onClick={() => void testScenario()}>{testing ? "호출 중" : "Mock 호출"}</button><button type="button" onClick={openInWorkspace}>Workspace에서 열기</button></div>
          {testError ? <p className="field-error" role="alert">{testError}</p> : null}{testResponse ? <section className="mock-test-response"><header><strong className={testResponse.status < 400 ? "success-text" : "danger-text"}>{testResponse.status} {testResponse.statusText}</strong><span>{testResponse.elapsedMilliseconds}ms · {testResponse.sizeBytes} bytes</span></header><pre>{testResponse.body}</pre></section> : null}
        </> : <div className="portfolio-state-panel">편집할 Scenario를 선택해 주세요.</div>}</main>
      </div>
      <UtilityHelpDialog isOpen={helpOpen} title="Mock API Scenario Builder" description="실제 서버 없이 로딩·오류·순차 응답을 반복해서 재현합니다." onClose={() => setHelpOpen(false)}>
        <ApiToolGuide currentTool="MOCK" />
        <article>
          <h3>이 도구가 필요한 이유</h3>
          <p>
            화면을 만들 때 정작 확인하기 어려운 것이 <strong>실패했을 때의 모습</strong>입니다.
            서버가 500을 주는 상황, 응답이 5초 걸리는 상황, 토큰이 만료된 상황을 실제로 만들어 내기 어렵기 때문입니다.
            이 도구는 그런 응답을 원하는 대로 만들어 주므로, 로딩 표시와 오류 화면이 제대로 동작하는지 확인할 수 있습니다.
            백엔드가 아직 없을 때 화면을 먼저 개발하는 용도로도 씁니다.
          </p>
        </article>
        <article>
          <h3>사용 절차</h3>
          <ol>
            <li><strong>Scenario 만들기</strong> — 경로와 응답(상태 코드·본문·지연 시간)을 정합니다.</li>
            <li><strong>응답 모드 선택</strong> — 고정 / 순차 / 무작위 중 고릅니다.</li>
            <li><strong>API Workspace에서 호출</strong> — URL에 <code>mock://</code> 를 붙여 요청합니다.</li>
            <li><strong>화면 확인</strong> — 만들어 둔 응답이 돌아와 화면 반응을 볼 수 있습니다.</li>
          </ol>
        </article>
        <article>
          <h3>응답 모드</h3>
          <ul>
            <li><strong>고정</strong> — 몇 번을 호출해도 같은 응답. 정상 화면을 만들 때.</li>
            <li><strong>순차</strong> — 호출할 때마다 다음 응답. 상태가 바뀌는 흐름을 볼 때.</li>
            <li><strong>무작위</strong> — 조건에 맞는 응답 중 하나. 불안정한 서버를 흉내 낼 때.</li>
          </ul>
        </article>
        <article>
          <h3>활용 예</h3>
          <p>
            순차 모드로 <strong>첫 호출 200 → 두 번째 401 → 세 번째 500</strong> 을 구성하면
            정상 동작, 토큰 만료 후 재로그인, 서버 오류 화면을 한 번에 이어서 확인할 수 있습니다.
          </p>
        </article>
        <article>
          <h3>mock:// 프로토콜</h3>
          <p>
            브라우저 네트워크로 나가지 않고 API Workspace 실행기가 저장된 Scenario를 찾아 응답합니다.
            예: <code>mock://local/api/mock/items</code>
            실제 요청이 아니므로 CORS 문제도 없고 서버에 부담도 주지 않습니다.
          </p>
        </article>
      </UtilityHelpDialog>
    </section>
  );
};
