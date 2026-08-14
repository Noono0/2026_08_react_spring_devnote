import type { ApiWorkspaceEnvironment } from "@/features/utility/types/apiWorkspaceTypes";

export type ApiWorkspaceSplitView = "STACKED" | "SIDE_BY_SIDE";

interface ApiWorkspaceToolbarProps {
  environments: ApiWorkspaceEnvironment[];
  activeEnvironmentId?: string;
  splitView: ApiWorkspaceSplitView;
  onEnvironmentSelect: (environmentId?: string) => void;
  onSplitViewChange: (splitView: ApiWorkspaceSplitView) => void;
  onNewRequest: () => void;
  onInterchangeOpen: () => void;
  onCollectionRunnerOpen: () => void;
  onHelpOpen: () => void;
}

export const ApiWorkspaceToolbar = ({
  environments,
  activeEnvironmentId,
  splitView,
  onEnvironmentSelect,
  onSplitViewChange,
  onNewRequest,
  onInterchangeOpen,
  onCollectionRunnerOpen,
  onHelpOpen,
}: ApiWorkspaceToolbarProps) => (
  <header className="api-workbench-toolbar">
    <div className="api-workbench-project">
      <span className="api-workbench-project-mark">DN</span>
      <div><strong>DevNote API</strong><small>Request-first workspace</small></div>
      <span className="api-workbench-online"><i />Online</span>
    </div>

    <nav className="api-workbench-mode-tabs" aria-label="API Workspace 작업 모드">
      <button type="button" className="active">API 테스트</button>
      <button type="button" onClick={onCollectionRunnerOpen}>테스트 시나리오</button>
    </nav>

    <div className="api-workbench-actions">
      <label className="api-workbench-environment">
        <span>Environment</span>
        <select value={activeEnvironmentId ?? ""} aria-label="상단 Environment 선택" onChange={(event) => onEnvironmentSelect(event.target.value || undefined)}>
          <option value="">환경 없음</option>
          {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
        </select>
      </label>
      <div className="api-split-controls" role="group" aria-label="요청과 응답 배치">
        <button type="button" className={splitView === "STACKED" ? "active" : undefined} aria-label="요청과 응답 상하 배치" title="상하 배치" onClick={() => onSplitViewChange("STACKED")}>↕</button>
        <button type="button" className={splitView === "SIDE_BY_SIDE" ? "active" : undefined} aria-label="요청과 응답 좌우 배치" title="좌우 배치" onClick={() => onSplitViewChange("SIDE_BY_SIDE")}>↔</button>
      </div>
      <button type="button" className="api-workbench-tool-button" onClick={onInterchangeOpen}>가져오기 · 내보내기</button>
      <button type="button" className="api-workbench-new-button" onClick={onNewRequest}>+ 새 요청</button>
      <button type="button" className="api-workbench-help-button" aria-label="API Workspace 도움말" onClick={onHelpOpen}>?</button>
    </div>
  </header>
);
