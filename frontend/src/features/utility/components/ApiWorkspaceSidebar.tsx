import { useMemo, useState } from "react";
import type {
  ApiWorkspaceCollection,
  ApiWorkspaceEnvironment,
  ApiWorkspaceFolder,
  ApiWorkspaceHistoryItem,
  ApiWorkspaceMethod,
  ApiWorkspacePanel,
  ApiWorkspaceSavedRequest,
} from "@/features/utility/types/apiWorkspaceTypes";
import { filterApiWorkspaceCollectionTree } from "@/features/utility/utils/apiWorkspaceUtils";
import { createUuid } from "@/shared/lib/createUuid";

interface ApiWorkspaceSidebarProps {
  activePanel: ApiWorkspacePanel;
  authenticated: boolean;
  historyItems: ApiWorkspaceHistoryItem[];
  collections: ApiWorkspaceCollection[];
  folders: ApiWorkspaceFolder[];
  savedRequests: ApiWorkspaceSavedRequest[];
  environments: ApiWorkspaceEnvironment[];
  activeEnvironmentId?: string;
  activeSavedRequestId?: string;
  selectedHistoryIds: Set<string>;
  onPanelChange: (panel: ApiWorkspacePanel) => void;
  onHistoryOpen: (historyItem: ApiWorkspaceHistoryItem) => void;
  onHistorySelectionChange: (historyId: string, selected: boolean) => void;
  onDeleteSelectedHistory: () => void;
  onClearHistory: () => void;
  onSavedRequestOpen: (savedRequest: ApiWorkspaceSavedRequest) => void;
  onSavedRequestFavoriteToggle: (savedRequestId: string) => void;
  onSavedRequestDuplicate: (savedRequestId: string) => void;
  onSavedRequestMove: (savedRequest: ApiWorkspaceSavedRequest) => void;
  onSavedRequestDelete: (savedRequestId: string) => void;
  onSavedRequestRestore: (savedRequestId: string) => void;
  onSavedRequestPermanentDelete: (savedRequestId: string) => void;
  onCollectionCreate: () => void;
  onCollectionRequestCreate: (collectionId: string, folderId?: string) => void;
  onCollectionRun: (collectionId: string) => void;
  onCollectionRename: (collection: ApiWorkspaceCollection) => void;
  onCollectionDelete: (collectionId: string) => void;
  onFolderCreate: (collectionId: string) => void;
  onFolderRename: (folder: ApiWorkspaceFolder) => void;
  onFolderDelete: (folderId: string) => void;
  onEnvironmentCreate: () => void;
  onEnvironmentSelect: (environmentId?: string) => void;
  onEnvironmentChange: (environment: ApiWorkspaceEnvironment) => void;
  onEnvironmentDelete: (environmentId: string) => void;
}

const panels: Array<{ value: ApiWorkspacePanel; label: string; symbol: string }> = [
  { value: "HISTORY", label: "History", symbol: "↶" },
  { value: "COLLECTIONS", label: "Collections", symbol: "▱" },
  { value: "ENVIRONMENTS", label: "Environments", symbol: "◇" },
  { value: "FAVORITES", label: "Favorites", symbol: "☆" },
];

const methodColors: Record<ApiWorkspaceMethod, string> = {
  GET: "method-get", POST: "method-post", PUT: "method-put", PATCH: "method-patch",
  DELETE: "method-delete", HEAD: "method-head", OPTIONS: "method-options",
};

export const ApiWorkspaceSidebar = ({
  activePanel,
  authenticated,
  historyItems,
  collections,
  folders,
  savedRequests,
  environments,
  activeEnvironmentId,
  activeSavedRequestId,
  selectedHistoryIds,
  onPanelChange,
  onHistoryOpen,
  onHistorySelectionChange,
  onDeleteSelectedHistory,
  onClearHistory,
  onSavedRequestOpen,
  onSavedRequestFavoriteToggle,
  onSavedRequestDuplicate,
  onSavedRequestMove,
  onSavedRequestDelete,
  onSavedRequestRestore,
  onSavedRequestPermanentDelete,
  onCollectionCreate,
  onCollectionRequestCreate,
  onCollectionRun,
  onCollectionRename,
  onCollectionDelete,
  onFolderCreate,
  onFolderRename,
  onFolderDelete,
  onEnvironmentCreate,
  onEnvironmentSelect,
  onEnvironmentChange,
  onEnvironmentDelete,
}: ApiWorkspaceSidebarProps) => {
  const [historySearch, setHistorySearch] = useState("");
  const [historyMethod, setHistoryMethod] = useState<"ALL" | ApiWorkspaceMethod>("ALL");
  const [collectionSearch, setCollectionSearch] = useState("");

  const visibleHistoryItems = useMemo(() => historyItems.filter((historyItem) => {
    const matchesSearch = historyItem.request.url.toLowerCase().includes(historySearch.trim().toLowerCase());
    const matchesMethod = historyMethod === "ALL" || historyItem.request.method === historyMethod;
    return matchesSearch && matchesMethod;
  }), [historyItems, historyMethod, historySearch]);
  const collectionTree = useMemo(
    () => filterApiWorkspaceCollectionTree(collections, folders, savedRequests, collectionSearch),
    [collectionSearch, collections, folders, savedRequests],
  );

  const renderLoginNotice = () => (
    <div className="api-sidebar-empty"><strong>로그인이 필요합니다.</strong><p>회원별 저장 기능은 로그인 후 사용할 수 있습니다.</p></div>
  );

  const renderHistory = () => {
    if (!authenticated) return renderLoginNotice();
    return (
      <>
        <div className="api-sidebar-filters">
          <input value={historySearch} aria-label="History URL 검색" placeholder="URL 검색" onChange={(event) => setHistorySearch(event.target.value)} />
          <select value={historyMethod} aria-label="History Method 필터" onChange={(event) => setHistoryMethod(event.target.value as "ALL" | ApiWorkspaceMethod)}>
            <option value="ALL">전체 Method</option>
            {Object.keys(methodColors).map((method) => <option key={method}>{method}</option>)}
          </select>
        </div>
        <div className="api-sidebar-selection">
          <span>{selectedHistoryIds.size > 0 ? `${selectedHistoryIds.size}개 선택` : `${visibleHistoryItems.length}개 이력`}</span>
          <div>
            {selectedHistoryIds.size > 0 ? <button type="button" onClick={onDeleteSelectedHistory}>선택 삭제</button> : null}
            {historyItems.length > 0 ? <button type="button" onClick={onClearHistory}>전체 삭제</button> : null}
          </div>
        </div>
        <div className="api-sidebar-list">
          {visibleHistoryItems.map((historyItem) => (
            <article className="api-history-item" key={historyItem.id}>
              <label>
                <input type="checkbox" checked={selectedHistoryIds.has(historyItem.id)} onChange={(event) => onHistorySelectionChange(historyItem.id, event.target.checked)} />
                <span className={methodColors[historyItem.request.method]}>{historyItem.request.method}</span>
              </label>
              <button type="button" onClick={() => onHistoryOpen(historyItem)}>
                <strong>{historyItem.request.name || historyItem.request.url}</strong>
                <small>{historyItem.request.url}</small>
                <span><i className={historyItem.successful ? "success" : "failure"} />{historyItem.responseStatus ?? "ERR"} · {historyItem.responseTimeMilliseconds}ms</span>
              </button>
            </article>
          ))}
          {visibleHistoryItems.length === 0 ? <div className="api-sidebar-empty"><strong>실행 이력이 없습니다.</strong><p>요청을 실행하면 최신순으로 표시됩니다.</p></div> : null}
        </div>
      </>
    );
  };

  const renderSavedRequest = (savedRequest: ApiWorkspaceSavedRequest) => (
    <div className={`api-saved-request${activeSavedRequestId === savedRequest.id ? " active" : ""}`} key={savedRequest.id}>
      <button type="button" aria-current={activeSavedRequestId === savedRequest.id ? "true" : undefined} onClick={() => onSavedRequestOpen(savedRequest)}>
        <span className={methodColors[savedRequest.request.method]}>{savedRequest.request.method}</span>
        <strong>{savedRequest.name}</strong>
      </button>
      <div>
        <button type="button" aria-label={`${savedRequest.name} 이동`} title="Collection 또는 Folder 이동" onClick={() => onSavedRequestMove(savedRequest)}>↗</button>
        <button type="button" aria-label={`${savedRequest.name} 복제`} title="요청 복제" onClick={() => onSavedRequestDuplicate(savedRequest.id)}>⧉</button>
        <button type="button" aria-label={`${savedRequest.name} 즐겨찾기`} onClick={() => onSavedRequestFavoriteToggle(savedRequest.id)}>{savedRequest.favorite ? "★" : "☆"}</button>
        <button type="button" aria-label={`${savedRequest.name} 휴지통으로 이동`} onClick={() => onSavedRequestDelete(savedRequest.id)}>×</button>
      </div>
    </div>
  );

  const renderCollections = () => {
    if (!authenticated) return renderLoginNotice();
    const deletedSavedRequests = savedRequests.filter((savedRequest) => savedRequest.deletedAt);
    return (
      <>
        <div className="api-collection-panel-heading">
          <div><strong>API 디렉터리</strong><span>{collections.length} Collections · {savedRequests.filter((savedRequest) => !savedRequest.deletedAt).length} Requests</span></div>
          <button type="button" aria-label="Collection 만들기" onClick={onCollectionCreate}>+</button>
        </div>
        <label className="api-collection-search"><span>⌕</span><input value={collectionSearch} aria-label="Collection 요청 검색" placeholder="API 이름, URL 검색" onChange={(event) => setCollectionSearch(event.target.value)} />{collectionSearch ? <button type="button" aria-label="Collection 검색어 지우기" onClick={() => setCollectionSearch("")}>×</button> : null}</label>
        <div className="api-sidebar-list">
          {collectionTree.map(({ collection, rootRequests, folders: collectionFolders }) => (
            <details className="api-collection" key={collection.id} open>
              <summary><span>▾</span><strong>{collection.name}</strong><small>{rootRequests.length + collectionFolders.reduce((requestCount, folderNode) => requestCount + folderNode.requests.length, 0)}</small><div><button type="button" aria-label={`${collection.name} 실행`} title="Collection Runner" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onCollectionRun(collection.id); }}>▶</button><button type="button" aria-label={`${collection.name}에 요청 추가`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onCollectionRequestCreate(collection.id); }}>+ Request</button><button type="button" aria-label={`${collection.name}에 Folder 추가`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onFolderCreate(collection.id); }}>+ Folder</button><button type="button" aria-label={`${collection.name} 이름 변경`} title="이름 변경" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onCollectionRename(collection); }}>✎</button><button type="button" aria-label={`${collection.name} 삭제`} title="삭제" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onCollectionDelete(collection.id); }}>×</button></div></summary>
              <div className="api-collection-requests">
                {rootRequests.map(renderSavedRequest)}
                {collectionFolders.map(({ folder, requests }) => (
                  <details className="api-folder" key={folder.id} open>
                    <summary><span>⌞</span><strong>{folder.name}</strong><small>{requests.length}</small><div><button type="button" aria-label={`${folder.name} Folder에 요청 추가`} title="새 요청" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onCollectionRequestCreate(collection.id, folder.id); }}>+</button><button type="button" aria-label={`${folder.name} Folder 이름 변경`} title="이름 변경" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onFolderRename(folder); }}>✎</button><button type="button" aria-label={`${folder.name} Folder 삭제`} title="삭제" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onFolderDelete(folder.id); }}>×</button></div></summary>
                    {requests.map(renderSavedRequest)}
                  </details>
                ))}
              </div>
            </details>
          ))}
          {collections.length === 0 ? <div className="api-sidebar-empty"><strong>Collection이 없습니다.</strong><p>관련 요청을 폴더로 정리해 보세요.</p></div> : null}
          {collections.length > 0 && collectionTree.length === 0 ? <div className="api-sidebar-empty"><strong>검색 결과가 없습니다.</strong><p>다른 API 이름이나 URL을 입력해 보세요.</p></div> : null}
          {deletedSavedRequests.length > 0 ? (
            <details className="api-trash" open>
              <summary>휴지통 <span>{deletedSavedRequests.length}</span></summary>
              {deletedSavedRequests.map((savedRequest) => (
                <div className="api-trash-item" key={savedRequest.id}>
                  <div><span className={methodColors[savedRequest.request.method]}>{savedRequest.request.method}</span><strong>{savedRequest.name}</strong></div>
                  <div><button type="button" onClick={() => onSavedRequestRestore(savedRequest.id)}>복구</button><button type="button" className="danger-text" onClick={() => onSavedRequestPermanentDelete(savedRequest.id)}>완전 삭제</button></div>
                </div>
              ))}
            </details>
          ) : null}
        </div>
      </>
    );
  };

  const renderFavorites = () => {
    if (!authenticated) return renderLoginNotice();
    const favorites = savedRequests.filter((savedRequest) => savedRequest.favorite && !savedRequest.deletedAt);
    return <div className="api-sidebar-list">{favorites.map(renderSavedRequest)}{favorites.length === 0 ? <div className="api-sidebar-empty"><strong>즐겨찾기가 없습니다.</strong><p>자주 쓰는 요청에 ☆를 눌러보세요.</p></div> : null}</div>;
  };

  const renderEnvironments = () => {
    if (!authenticated) return renderLoginNotice();
    const activeEnvironment = environments.find((environment) => environment.id === activeEnvironmentId);
    return (
      <div className="api-environment-panel">
        <button type="button" className="api-sidebar-primary-action" onClick={onEnvironmentCreate}>+ Environment</button>
        <label>현재 환경
          <select value={activeEnvironmentId ?? ""} onChange={(event) => onEnvironmentSelect(event.target.value || undefined)}>
            <option value="">환경 사용 안 함</option>
            {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
          </select>
        </label>
        {activeEnvironment ? (
          <div className="api-environment-editor">
            <div className="api-environment-name-row">
              <input aria-label="Environment 이름" value={activeEnvironment.name} onChange={(event) => onEnvironmentChange({ ...activeEnvironment, name: event.target.value })} />
              <button type="button" className="api-icon-button" aria-label={`${activeEnvironment.name} Environment 삭제`} onClick={() => onEnvironmentDelete(activeEnvironment.id)}>×</button>
            </div>
            <div className="api-environment-variable-heading"><span>사용</span><span>변수</span><span>값</span><span>Secret</span><span /></div>
            {activeEnvironment.variables.map((variable, variableIndex) => (
              <div className="api-environment-variable-row" key={variable.id}>
                <input type="checkbox" checked={variable.enabled} aria-label={`${variableIndex + 1}번째 환경변수 사용`} onChange={(event) => onEnvironmentChange({ ...activeEnvironment, variables: activeEnvironment.variables.map((currentVariable) => currentVariable.id === variable.id ? { ...currentVariable, enabled: event.target.checked } : currentVariable) })} />
                <input value={variable.key} aria-label={`${variableIndex + 1}번째 환경변수 이름`} placeholder="baseUrl" onChange={(event) => onEnvironmentChange({ ...activeEnvironment, variables: activeEnvironment.variables.map((currentVariable) => currentVariable.id === variable.id ? { ...currentVariable, key: event.target.value } : currentVariable) })} />
                <input type={variable.secret ? "password" : "text"} value={variable.value} autoComplete="off" aria-label={`${variableIndex + 1}번째 환경변수 값`} placeholder={variable.secret ? "현재 세션에서만 유지" : "http://localhost:8080"} onChange={(event) => onEnvironmentChange({ ...activeEnvironment, variables: activeEnvironment.variables.map((currentVariable) => currentVariable.id === variable.id ? { ...currentVariable, value: event.target.value } : currentVariable) })} />
                <input type="checkbox" checked={variable.secret} aria-label={`${variableIndex + 1}번째 환경변수 Secret`} onChange={(event) => onEnvironmentChange({ ...activeEnvironment, variables: activeEnvironment.variables.map((currentVariable) => currentVariable.id === variable.id ? { ...currentVariable, secret: event.target.checked } : currentVariable) })} />
                <button type="button" className="api-icon-button" aria-label={`${variableIndex + 1}번째 환경변수 삭제`} onClick={() => onEnvironmentChange({ ...activeEnvironment, variables: activeEnvironment.variables.filter((currentVariable) => currentVariable.id !== variable.id) })}>×</button>
              </div>
            ))}
            <button type="button" className="ghost-button api-add-row-button" onClick={() => onEnvironmentChange({ ...activeEnvironment, variables: [...activeEnvironment.variables, { id: createUuid(), key: "", value: "", secret: false, enabled: true }] })}>+ 변수 추가</button>
            <p>요청에 <code>{"{{baseUrl}}"}</code>처럼 입력합니다. Secret 값은 새로고침 후 비워집니다.</p>
          </div>
        ) : <div className="api-sidebar-empty"><strong>선택한 환경이 없습니다.</strong><p>Local·Development처럼 실행 환경을 만들 수 있습니다.</p></div>}
      </div>
    );
  };

  return (
    <aside className="api-workspace-sidebar" aria-label="API Workspace 탐색기">
      <div className="api-sidebar-tabs" role="tablist" aria-label="저장 데이터 종류">
        {panels.map((panel) => <button key={panel.value} type="button" role="tab" aria-selected={activePanel === panel.value} className={activePanel === panel.value ? "active" : undefined} onClick={() => onPanelChange(panel.value)}><span>{panel.symbol}</span>{panel.label}</button>)}
      </div>
      <div className="api-sidebar-content">
        {activePanel === "HISTORY" ? renderHistory() : null}
        {activePanel === "COLLECTIONS" ? renderCollections() : null}
        {activePanel === "FAVORITES" ? renderFavorites() : null}
        {activePanel === "ENVIRONMENTS" ? renderEnvironments() : null}
      </div>
    </aside>
  );
};
