import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { ApiCollectionRunnerDialog } from "@/features/utility/components/ApiCollectionRunnerDialog";
import { ApiWorkspaceSidebar } from "@/features/utility/components/ApiWorkspaceSidebar";
import { ApiWorkspaceInterchangeDialog } from "@/features/utility/components/ApiWorkspaceInterchangeDialog";
import { ApiWorkspaceRequestEditor } from "@/features/utility/components/ApiWorkspaceRequestEditor";
import { ApiWorkspaceResponseViewer } from "@/features/utility/components/ApiWorkspaceResponseViewer";
import { ApiWorkspaceToolbar, type ApiWorkspaceSplitView } from "@/features/utility/components/ApiWorkspaceToolbar";
import { ApiWorkspaceModuleNav } from "@/features/utility/components/ApiWorkspaceModuleNav";
import type {
  ApiWorkspaceActualRequest,
  ApiWorkspaceCollection,
  ApiWorkspaceEnvironment,
  ApiWorkspaceFolder,
  ApiWorkspaceHistoryItem,
  ApiWorkspaceMethod,
  ApiWorkspacePanel,
  ApiWorkspaceRequest,
  ApiWorkspaceResponse,
  ApiWorkspaceSavedRequest,
  ApiWorkspaceTab,
  RequestEditorSection,
  ResponseBodyView,
  ResponseViewerSection,
} from "@/features/utility/types/apiWorkspaceTypes";
import {
  API_WORKSPACE_MAX_HISTORY_ITEMS,
  createApiWorkspaceActualRequest,
  createApiWorkspaceTab,
  createApiWorkspaceSaveDraft,
  createWorkspaceId,
  findOpenApiWorkspaceTab,
  isTextResponseContentType,
  parseStoredHistory,
  parseStoredTabs,
  sanitizeRequestForStorage,
  serializeTabsForStorage,
} from "@/features/utility/utils/apiWorkspaceUtils";
import { executeApiWorkspaceRequest } from "@/features/utility/utils/apiWorkspaceExecutor";
import { generateApiCode, parseCurlRequest, type ApiCodeTarget } from "@/features/utility/utils/apiCodeGenerator";
import { copyText } from "@/features/utility/utils/browserFileUtils";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { ApiToolGuide } from "@/features/utility/components/ApiToolGuide";

const methods: ApiWorkspaceMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const parseStoredArray = <Value,>(storedValue: string | null): Value[] => {
  if (!storedValue) return [];
  try {
    const parsedValue = JSON.parse(storedValue) as Value[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

export const ApiWorkspacePage = () => {
  const sessionQuery = useAuthSessionQuery();
  const authenticatedMemberId = sessionQuery.data?.authenticated ? sessionQuery.data.memberId : undefined;
  const storageScope = authenticatedMemberId ? `member-${authenticatedMemberId}` : "guest";
  const storagePrefix = `devnote-api-workspace:${storageScope}`;

  const [tabs, setTabs] = useState<ApiWorkspaceTab[]>([createApiWorkspaceTab()]);
  const [activeTabId, setActiveTabId] = useState("");
  const [activePanel, setActivePanel] = useState<ApiWorkspacePanel>("HISTORY");
  const [requestSection, setRequestSection] = useState<RequestEditorSection>("PARAMS");
  const [responseSection, setResponseSection] = useState<ResponseViewerSection>("BODY");
  const [responseBodyView, setResponseBodyView] = useState<ResponseBodyView>("PRETTY");
  const [splitView, setSplitView] = useState<ApiWorkspaceSplitView>("STACKED");
  const [response, setResponse] = useState<ApiWorkspaceResponse>();
  const [actualRequest, setActualRequest] = useState<ApiWorkspaceActualRequest>();
  const [requestError, setRequestError] = useState<string>();
  const [isSending, setSending] = useState(false);
  const [historyItems, setHistoryItems] = useState<ApiWorkspaceHistoryItem[]>([]);
  const [collections, setCollections] = useState<ApiWorkspaceCollection[]>([]);
  const [folders, setFolders] = useState<ApiWorkspaceFolder[]>([]);
  const [savedRequests, setSavedRequests] = useState<ApiWorkspaceSavedRequest[]>([]);
  const [environments, setEnvironments] = useState<ApiWorkspaceEnvironment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string>();
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const [clearHistoryConfirmOpen, setClearHistoryConfirmOpen] = useState(false);
  const [closeTabTargetId, setCloseTabTargetId] = useState<string>();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveCollectionId, setSaveCollectionId] = useState("");
  const [saveFolderId, setSaveFolderId] = useState("");
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [resumeSaveAfterCollectionCreate, setResumeSaveAfterCollectionCreate] = useState(false);
  const [collectionRenameTargetId, setCollectionRenameTargetId] = useState<string>();
  const [collectionRenameName, setCollectionRenameName] = useState("");
  const [collectionDeleteTargetId, setCollectionDeleteTargetId] = useState<string>();
  const [folderCollectionId, setFolderCollectionId] = useState<string>();
  const [folderName, setFolderName] = useState("");
  const [folderRenameTargetId, setFolderRenameTargetId] = useState<string>();
  const [folderRenameName, setFolderRenameName] = useState("");
  const [folderDeleteTargetId, setFolderDeleteTargetId] = useState<string>();
  const [moveSavedRequestTargetId, setMoveSavedRequestTargetId] = useState<string>();
  const [moveCollectionId, setMoveCollectionId] = useState("");
  const [moveFolderId, setMoveFolderId] = useState("");
  const [environmentDialogOpen, setEnvironmentDialogOpen] = useState(false);
  const [environmentName, setEnvironmentName] = useState("");
  const [environmentDeleteTargetId, setEnvironmentDeleteTargetId] = useState<string>();
  const [savedRequestPermanentDeleteTargetId, setSavedRequestPermanentDeleteTargetId] = useState<string>();
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [interchangeDialogOpen, setInterchangeDialogOpen] = useState(false);
  const [collectionRunnerOpen, setCollectionRunnerOpen] = useState(false);
  const [runnerDefaultCollectionId, setRunnerDefaultCollectionId] = useState<string>();
  const [codeTarget, setCodeTarget] = useState<ApiCodeTarget>("CURL");
  const [curlImportText, setCurlImportText] = useState("");
  const [curlWarnings, setCurlWarnings] = useState<string[]>([]);
  const [loadedStorageScope, setLoadedStorageScope] = useState<string>();
  const abortControllerReference = useRef<AbortController | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const activeRequest = activeTab?.request;
  const workspaceLoaded = loadedStorageScope === storageScope;

  useEffect(() => {
    if (sessionQuery.isPending) return;
    setLoadedStorageScope(undefined);
    abortControllerReference.current?.abort("MEMBER_SCOPE_CHANGED");
    setResponse(undefined);
    setActualRequest(undefined);
    setRequestError(undefined);
    setSelectedHistoryIds(new Set());
    const storedTabs = parseStoredTabs(localStorage.getItem(`${storagePrefix}:tabs`));
    const nextTabs = storedTabs.length > 0 ? storedTabs : [createApiWorkspaceTab()];
    setTabs(nextTabs);
    setActiveTabId(nextTabs[0]?.id ?? "");
    if (authenticatedMemberId) {
      setHistoryItems(parseStoredHistory(localStorage.getItem(`${storagePrefix}:history`)));
      setCollections(parseStoredArray<ApiWorkspaceCollection>(localStorage.getItem(`${storagePrefix}:collections`)));
      setFolders(parseStoredArray<ApiWorkspaceFolder>(localStorage.getItem(`${storagePrefix}:folders`)));
      setSavedRequests(parseStoredArray<ApiWorkspaceSavedRequest>(localStorage.getItem(`${storagePrefix}:saved-requests`)));
      const storedEnvironments = parseStoredArray<ApiWorkspaceEnvironment>(localStorage.getItem(`${storagePrefix}:environments`));
      const storedActiveEnvironmentId = localStorage.getItem(`${storagePrefix}:active-environment-id`) || undefined;
      setEnvironments(storedEnvironments);
      setActiveEnvironmentId(storedEnvironments.some((environment) => environment.id === storedActiveEnvironmentId) ? storedActiveEnvironmentId : undefined);
    } else {
      setHistoryItems([]); setCollections([]); setFolders([]); setSavedRequests([]); setEnvironments([]); setActiveEnvironmentId(undefined);
    }
    setLoadedStorageScope(storageScope);
  }, [authenticatedMemberId, sessionQuery.isPending, storagePrefix, storageScope]);

  useEffect(() => {
    if (!workspaceLoaded) return;
    localStorage.setItem(`${storagePrefix}:tabs`, serializeTabsForStorage(tabs));
  }, [storagePrefix, tabs, workspaceLoaded]);

  useEffect(() => {
    if (!workspaceLoaded || !authenticatedMemberId) return;
    localStorage.setItem(`${storagePrefix}:history`, JSON.stringify(historyItems));
    localStorage.setItem(`${storagePrefix}:collections`, JSON.stringify(collections));
    localStorage.setItem(`${storagePrefix}:folders`, JSON.stringify(folders));
    localStorage.setItem(`${storagePrefix}:saved-requests`, JSON.stringify(savedRequests.map((savedRequest) => ({ ...savedRequest, request: sanitizeRequestForStorage(savedRequest.request) }))));
    localStorage.setItem(`${storagePrefix}:environments`, JSON.stringify(environments.map((environment) => ({
      ...environment,
      variables: environment.variables.map((variable) => ({ ...variable, value: variable.secret ? "" : variable.value })),
    }))));
    if (activeEnvironmentId) localStorage.setItem(`${storagePrefix}:active-environment-id`, activeEnvironmentId);
    else localStorage.removeItem(`${storagePrefix}:active-environment-id`);
  }, [activeEnvironmentId, authenticatedMemberId, collections, environments, folders, historyItems, savedRequests, storagePrefix, workspaceLoaded]);

  const updateActiveRequest = (nextRequest: ApiWorkspaceRequest): void => {
    if (!activeTab) return;
    setTabs((currentTabs) => currentTabs.map((tab) => tab.id === activeTab.id ? { ...tab, request: nextRequest, dirty: true } : tab));
  };

  const activateTab = (tabId: string): void => {
    setActiveTabId(tabId);
    setResponse(undefined);
    setActualRequest(undefined);
    setRequestError(undefined);
  };

  const addTab = (
    request?: ApiWorkspaceRequest,
    source: Partial<Pick<ApiWorkspaceTab, "historyItemId" | "savedRequestId" | "saveTargetCollectionId" | "saveTargetFolderId">> = {},
  ): void => {
    const nextTab = createApiWorkspaceTab(request);
    nextTab.savedRequestId = source.savedRequestId;
    nextTab.historyItemId = source.historyItemId;
    nextTab.saveTargetCollectionId = source.saveTargetCollectionId;
    nextTab.saveTargetFolderId = source.saveTargetFolderId;
    nextTab.dirty = false;
    setTabs((currentTabs) => [...currentTabs, nextTab]);
    activateTab(nextTab.id);
  };

  const openHistoryItem = (historyItem: ApiWorkspaceHistoryItem): void => {
    const openTab = findOpenApiWorkspaceTab(tabs, { historyItemId: historyItem.id });
    if (openTab) {
      activateTab(openTab.id);
      return;
    }
    addTab(historyItem.request, { historyItemId: historyItem.id });
  };

  const openSavedRequest = (savedRequest: ApiWorkspaceSavedRequest): void => {
    const openTab = findOpenApiWorkspaceTab(tabs, { savedRequestId: savedRequest.id });
    if (openTab) {
      activateTab(openTab.id);
      return;
    }
    addTab(savedRequest.request, { savedRequestId: savedRequest.id });
  };

  const createRequestInCollection = (collectionId: string, folderId?: string): void => {
    addTab(undefined, { saveTargetCollectionId: collectionId, saveTargetFolderId: folderId });
    setActivePanel("COLLECTIONS");
    applicationNotification.success("Collection에 새 요청 탭을 만들었습니다.", "요청을 작성한 뒤 Save를 누르면 선택한 위치가 자동 지정됩니다.");
  };

  const closeTab = (tabId: string, force = false): void => {
    const targetTab = tabs.find((tab) => tab.id === tabId);
    if (!force && targetTab?.dirty) { setCloseTabTargetId(tabId); return; }
    const remainingTabs = tabs.filter((tab) => tab.id !== tabId);
    const nextTabs = remainingTabs.length > 0 ? remainingTabs : [createApiWorkspaceTab()];
    setTabs(nextTabs);
    if (tabId === activeTabId) setActiveTabId(nextTabs[0]?.id ?? "");
    setCloseTabTargetId(undefined);
  };

  const executeRequest = async (): Promise<void> => {
    if (!activeRequest || isSending) return;
    setRequestError(undefined); setResponse(undefined); setActualRequest(undefined); setSending(true);
    const startedAt = performance.now();
    let responseStatus: number | undefined;
    let responseSizeBytes = 0;
    let responseBody = "";

    const abortController = new AbortController();
    abortControllerReference.current = abortController;
    const timeoutId = window.setTimeout(() => abortController.abort("TIMEOUT"), activeRequest.timeoutMilliseconds);

    try {
      const activeEnvironment = environments.find((environment) => environment.id === activeEnvironmentId);
      setActualRequest(createApiWorkspaceActualRequest(activeRequest, activeEnvironment?.variables ?? []));
      const nextResponse = await executeApiWorkspaceRequest(activeRequest, activeEnvironment?.variables ?? [], abortController.signal);
      responseStatus = nextResponse.status;
      responseSizeBytes = nextResponse.sizeBytes;
      responseBody = isTextResponseContentType(nextResponse.contentType) ? nextResponse.body : "";
      setResponse(nextResponse);

      if (authenticatedMemberId && !activeRequest.privateExecution) {
        const historyItem: ApiWorkspaceHistoryItem = {
          id: createWorkspaceId(), request: sanitizeRequestForStorage(activeRequest), responseStatus: nextResponse.status,
          responseTimeMilliseconds: nextResponse.elapsedMilliseconds, responseSizeBytes: nextResponse.sizeBytes,
          responseBody: activeRequest.saveResponseBody ? responseBody : undefined,
          successful: nextResponse.status >= 200 && nextResponse.status < 300, executedAt: new Date().toISOString(),
        };
        setHistoryItems((currentItems) => [historyItem, ...currentItems].slice(0, API_WORKSPACE_MAX_HISTORY_ITEMS));
      }
    } catch (requestFailure) {
      const elapsedMilliseconds = Math.round(performance.now() - startedAt);
      const wasAborted = abortController.signal.aborted;
      const timeout = abortController.signal.reason === "TIMEOUT";
      const message = timeout ? `제한 시간 ${activeRequest.timeoutMilliseconds / 1000}초를 초과했습니다.` : wasAborted ? "사용자가 요청을 취소했습니다." : requestFailure instanceof Error ? requestFailure.message : "요청 실행 중 오류가 발생했습니다.";
      setRequestError(message);
      if (authenticatedMemberId && !activeRequest.privateExecution && !wasAborted) {
        setHistoryItems((currentItems) => [{ id: createWorkspaceId(), request: sanitizeRequestForStorage(activeRequest), responseStatus, responseTimeMilliseconds: elapsedMilliseconds, responseSizeBytes, responseBody: activeRequest.saveResponseBody ? responseBody : undefined, successful: false, executedAt: new Date().toISOString() }, ...currentItems].slice(0, API_WORKSPACE_MAX_HISTORY_ITEMS));
      }
    } finally {
      window.clearTimeout(timeoutId); abortControllerReference.current = null; setSending(false);
    }
  };

  const deleteHistoryItems = (historyIds: Set<string>): void => {
    const deletedItems = historyItems.filter((historyItem) => historyIds.has(historyItem.id));
    setHistoryItems((currentItems) => currentItems.filter((historyItem) => !historyIds.has(historyItem.id)));
    setSelectedHistoryIds(new Set());
    toast.success(`${deletedItems.length}개 History를 삭제했습니다.`, { duration: 6000, action: { label: "실행 취소", onClick: () => setHistoryItems((currentItems) => [...deletedItems, ...currentItems].sort((left, right) => right.executedAt.localeCompare(left.executedAt))) } });
  };

  const duplicateSavedRequest = (savedRequestId: string): void => {
    const sourceRequest = savedRequests.find((savedRequest) => savedRequest.id === savedRequestId);
    if (!sourceRequest) return;
    const now = new Date().toISOString();
    const duplicateName = `${sourceRequest.name} 복사본`;
    setSavedRequests((currentRequests) => [...currentRequests, {
      ...sourceRequest,
      id: createWorkspaceId(),
      name: duplicateName,
      favorite: false,
      request: { ...sourceRequest.request, id: createWorkspaceId(), name: duplicateName },
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined,
    }]);
    applicationNotification.success("저장 요청을 복제했습니다.", duplicateName);
  };

  const renameCollection = (): void => {
    if (!collectionRenameTargetId || !collectionRenameName.trim()) return;
    setCollections((currentCollections) => currentCollections.map((collection) => collection.id === collectionRenameTargetId ? { ...collection, name: collectionRenameName.trim() } : collection));
    setCollectionRenameTargetId(undefined);
    setCollectionRenameName("");
    applicationNotification.success("Collection 이름을 변경했습니다.");
  };

  const deleteCollection = (): void => {
    if (!collectionDeleteTargetId) return;
    const deletedAt = new Date().toISOString();
    setCollections((currentCollections) => currentCollections.filter((collection) => collection.id !== collectionDeleteTargetId));
    setFolders((currentFolders) => currentFolders.filter((folder) => folder.collectionId !== collectionDeleteTargetId));
    setSavedRequests((currentRequests) => currentRequests.map((savedRequest) => savedRequest.collectionId === collectionDeleteTargetId ? { ...savedRequest, deletedAt } : savedRequest));
    setCollectionDeleteTargetId(undefined);
    applicationNotification.success("Collection을 삭제했습니다.", "포함된 저장 요청은 휴지통으로 이동했습니다.");
  };

  const renameFolder = (): void => {
    if (!folderRenameTargetId || !folderRenameName.trim()) return;
    setFolders((currentFolders) => currentFolders.map((folder) => folder.id === folderRenameTargetId ? { ...folder, name: folderRenameName.trim() } : folder));
    setFolderRenameTargetId(undefined);
    setFolderRenameName("");
    applicationNotification.success("Folder 이름을 변경했습니다.");
  };

  const deleteFolder = (): void => {
    if (!folderDeleteTargetId) return;
    setFolders((currentFolders) => currentFolders.filter((folder) => folder.id !== folderDeleteTargetId));
    setSavedRequests((currentRequests) => currentRequests.map((savedRequest) => savedRequest.folderId === folderDeleteTargetId ? { ...savedRequest, folderId: undefined } : savedRequest));
    setFolderDeleteTargetId(undefined);
    applicationNotification.success("Folder를 삭제했습니다.", "포함된 요청은 Collection 최상위로 이동했습니다.");
  };

  const openSaveDialog = (): void => {
    if (!activeRequest) return;
    if (!authenticatedMemberId) { applicationNotification.warning("로그인이 필요합니다.", "저장 요청은 로그인 회원별로 관리됩니다."); return; }
    if (collections.length === 0) { applicationNotification.warning("Collection을 먼저 만들어 주세요.", "만든 뒤 현재 요청 저장을 바로 이어갑니다."); setActivePanel("COLLECTIONS"); setResumeSaveAfterCollectionCreate(true); setCollectionDescription(""); setCollectionDialogOpen(true); return; }
    const existingSavedRequest = activeTab.savedRequestId
      ? savedRequests.find((savedRequest) => savedRequest.id === activeTab.savedRequestId)
      : undefined;
    const saveDraft = createApiWorkspaceSaveDraft(activeRequest, collections, existingSavedRequest, { collectionId: activeTab.saveTargetCollectionId, folderId: activeTab.saveTargetFolderId });
    setSaveName(saveDraft.name);
    setSaveDescription(saveDraft.description);
    setSaveCollectionId(saveDraft.collectionId);
    setSaveFolderId(saveDraft.folderId);
    setSaveDialogOpen(true);
  };

  const saveCurrentRequest = (): void => {
    if (!activeRequest || !saveName.trim() || !saveCollectionId) return;
    const now = new Date().toISOString();
    const existingSavedRequest = activeTab?.savedRequestId ? savedRequests.find((savedRequest) => savedRequest.id === activeTab.savedRequestId) : undefined;
    if (existingSavedRequest) {
      setSavedRequests((currentRequests) => currentRequests.map((savedRequest) => savedRequest.id === existingSavedRequest.id ? { ...savedRequest, name: saveName.trim(), description: saveDescription.trim(), collectionId: saveCollectionId, folderId: saveFolderId || undefined, request: sanitizeRequestForStorage({ ...activeRequest, name: saveName.trim() }), updatedAt: now } : savedRequest));
    } else {
      const savedRequestId = createWorkspaceId();
      setSavedRequests((currentRequests) => [...currentRequests, { id: savedRequestId, name: saveName.trim(), description: saveDescription.trim(), collectionId: saveCollectionId, folderId: saveFolderId || undefined, favorite: false, request: sanitizeRequestForStorage({ ...activeRequest, name: saveName.trim() }), createdAt: now, updatedAt: now }]);
      setTabs((currentTabs) => currentTabs.map((tab) => tab.id === activeTab.id ? { ...tab, savedRequestId, saveTargetCollectionId: undefined, saveTargetFolderId: undefined } : tab));
    }
    setTabs((currentTabs) => currentTabs.map((tab) => tab.id === activeTab.id ? { ...tab, request: { ...tab.request, name: saveName.trim() }, dirty: false } : tab));
    setSaveDialogOpen(false); applicationNotification.success("요청을 저장했습니다.", "Secret과 선택한 파일은 저장되지 않습니다.");
  };

  const createCollection = (): void => {
    if (!collectionName.trim()) return;
    const collection: ApiWorkspaceCollection = { id: createWorkspaceId(), name: collectionName.trim(), description: collectionDescription.trim(), createdAt: new Date().toISOString() };
    setCollections((currentCollections) => [...currentCollections, collection]);
    setCollectionName("");
    setCollectionDescription("");
    setCollectionDialogOpen(false);
    setSaveCollectionId(collection.id);
    if (resumeSaveAfterCollectionCreate && activeRequest) {
      const saveDraft = createApiWorkspaceSaveDraft(activeRequest, [collection], undefined, { collectionId: collection.id });
      setSaveName(saveDraft.name);
      setSaveDescription(saveDraft.description);
      setSaveFolderId("");
      setSaveDialogOpen(true);
    }
    setResumeSaveAfterCollectionCreate(false);
  };

  const createFolder = (): void => {
    if (!folderName.trim() || !folderCollectionId) return;
    setFolders((currentFolders) => [...currentFolders, { id: createWorkspaceId(), collectionId: folderCollectionId, name: folderName.trim() }]); setFolderName(""); setFolderCollectionId(undefined);
  };

  const moveSavedRequest = (): void => {
    if (!moveSavedRequestTargetId || !moveCollectionId) return;
    setSavedRequests((currentRequests) => currentRequests.map((savedRequest) => savedRequest.id === moveSavedRequestTargetId ? {
      ...savedRequest,
      collectionId: moveCollectionId,
      folderId: moveFolderId || undefined,
      updatedAt: new Date().toISOString(),
    } : savedRequest));
    setMoveSavedRequestTargetId(undefined);
    setMoveCollectionId("");
    setMoveFolderId("");
    applicationNotification.success("저장 요청을 이동했습니다.");
  };

  const createEnvironment = (): void => {
    if (!environmentName.trim()) return;
    const environment: ApiWorkspaceEnvironment = {
      id: createWorkspaceId(),
      name: environmentName.trim(),
      variables: [{ id: createWorkspaceId(), key: "baseUrl", value: "http://localhost:8080", secret: false, enabled: true }],
    };
    setEnvironments((currentEnvironments) => [...currentEnvironments, environment]);
    setActiveEnvironmentId(environment.id);
    setEnvironmentName("");
    setEnvironmentDialogOpen(false);
  };

  const copyResponse = async (): Promise<void> => {
    if (!response) return;
    await navigator.clipboard.writeText(response.body); applicationNotification.success("응답을 복사했습니다.");
  };

  const downloadResponse = (): void => {
    if (!response) return;
    const downloadBlob = response.downloadBlob ?? new Blob([response.body], { type: response.contentType });
    const downloadUrl = URL.createObjectURL(downloadBlob); const anchor = document.createElement("a"); anchor.href = downloadUrl; anchor.download = response.contentType.includes("json") ? "response.json" : "response.txt"; anchor.click(); URL.revokeObjectURL(downloadUrl);
  };

  const availableFolders = useMemo(() => folders.filter((folder) => folder.collectionId === saveCollectionId), [folders, saveCollectionId]);
  const availableMoveFolders = useMemo(() => folders.filter((folder) => folder.collectionId === moveCollectionId), [folders, moveCollectionId]);
  const moveSavedRequestTarget = savedRequests.find((savedRequest) => savedRequest.id === moveSavedRequestTargetId);
  const generatedRequestCode = useMemo(() => activeRequest ? generateApiCode(codeTarget, activeRequest) : "", [activeRequest, codeTarget]);

  if (!activeTab || !activeRequest) return null;

  return (
    <section className="api-workspace-page">
      <header className="api-workspace-titlebar">
        <div><span className="page-kicker">Developer Utility · API Client</span><h1>API Workspace</h1><p>요청을 작성하고 응답을 분석하며, 자주 쓰는 API를 회원별 작업 공간으로 정리합니다.</p></div>
        <div><span className="api-browser-mode-badge">Browser mode</span></div>
      </header>

      <div className="api-workspace-security-banner"><span>ⓘ</span><p><strong>브라우저에서 직접 요청합니다.</strong> 별도 프록시를 사용하지 않아 내부망 접근 위험은 없지만, 대상 서버가 CORS를 허용해야 합니다. 현재 프로젝트 예제 API부터 실행해 보세요.</p></div>
      <ApiWorkspaceModuleNav />

      <div className="api-workspace-shell">
        <ApiWorkspaceToolbar environments={environments} activeEnvironmentId={activeEnvironmentId} splitView={splitView} onEnvironmentSelect={setActiveEnvironmentId} onSplitViewChange={setSplitView} onNewRequest={() => addTab()} onInterchangeOpen={() => setInterchangeDialogOpen(true)} onCollectionRunnerOpen={() => { setRunnerDefaultCollectionId(undefined); setCollectionRunnerOpen(true); }} onHelpOpen={() => setHelpOpen(true)} />
        <div className="api-workspace-layout">
        <ApiWorkspaceSidebar activePanel={activePanel} authenticated={Boolean(authenticatedMemberId)} historyItems={historyItems} collections={collections} folders={folders} savedRequests={savedRequests} environments={environments} activeEnvironmentId={activeEnvironmentId} activeSavedRequestId={activeTab.savedRequestId} selectedHistoryIds={selectedHistoryIds} onPanelChange={setActivePanel} onHistoryOpen={openHistoryItem} onHistorySelectionChange={(historyId, selected) => setSelectedHistoryIds((currentIds) => { const nextIds = new Set(currentIds); if (selected) nextIds.add(historyId); else nextIds.delete(historyId); return nextIds; })} onDeleteSelectedHistory={() => deleteHistoryItems(selectedHistoryIds)} onClearHistory={() => setClearHistoryConfirmOpen(true)} onSavedRequestOpen={openSavedRequest} onSavedRequestFavoriteToggle={(savedRequestId) => setSavedRequests((currentRequests) => currentRequests.map((savedRequest) => savedRequest.id === savedRequestId ? { ...savedRequest, favorite: !savedRequest.favorite } : savedRequest))} onSavedRequestDuplicate={duplicateSavedRequest} onSavedRequestMove={(savedRequest) => { setMoveSavedRequestTargetId(savedRequest.id); setMoveCollectionId(savedRequest.collectionId); setMoveFolderId(savedRequest.folderId ?? ""); }} onSavedRequestDelete={(savedRequestId) => { setSavedRequests((currentRequests) => currentRequests.map((savedRequest) => savedRequest.id === savedRequestId ? { ...savedRequest, deletedAt: new Date().toISOString() } : savedRequest)); toast.success("저장 요청을 휴지통으로 이동했습니다.", { action: { label: "실행 취소", onClick: () => setSavedRequests((currentRequests) => currentRequests.map((savedRequest) => savedRequest.id === savedRequestId ? { ...savedRequest, deletedAt: undefined } : savedRequest)) } }); }} onSavedRequestRestore={(savedRequestId) => { setSavedRequests((currentRequests) => currentRequests.map((savedRequest) => savedRequest.id === savedRequestId ? { ...savedRequest, deletedAt: undefined } : savedRequest)); applicationNotification.success("저장 요청을 복구했습니다."); }} onSavedRequestPermanentDelete={setSavedRequestPermanentDeleteTargetId} onCollectionCreate={() => { setResumeSaveAfterCollectionCreate(false); setCollectionDescription(""); setCollectionDialogOpen(true); }} onCollectionRequestCreate={createRequestInCollection} onCollectionRun={(collectionId) => { setRunnerDefaultCollectionId(collectionId); setCollectionRunnerOpen(true); }} onCollectionRename={(collection) => { setCollectionRenameTargetId(collection.id); setCollectionRenameName(collection.name); }} onCollectionDelete={setCollectionDeleteTargetId} onFolderCreate={(collectionId) => setFolderCollectionId(collectionId)} onFolderRename={(folder) => { setFolderRenameTargetId(folder.id); setFolderRenameName(folder.name); }} onFolderDelete={setFolderDeleteTargetId} onEnvironmentCreate={() => setEnvironmentDialogOpen(true)} onEnvironmentSelect={setActiveEnvironmentId} onEnvironmentChange={(environment) => setEnvironments((currentEnvironments) => currentEnvironments.map((currentEnvironment) => currentEnvironment.id === environment.id ? environment : currentEnvironment))} onEnvironmentDelete={setEnvironmentDeleteTargetId} />

        <main className="api-workspace-main">
          <div className="api-open-tabs" role="tablist" aria-label="열린 API 요청">
            {tabs.map((tab) => <div className={tab.id === activeTab.id ? "active" : undefined} key={tab.id}><button type="button" role="tab" aria-selected={tab.id === activeTab.id} onClick={() => activateTab(tab.id)}><span className={`method-${tab.request.method.toLowerCase()}`}>{tab.request.method}</span>{tab.request.name}{tab.dirty ? <i title="저장되지 않은 변경">●</i> : null}</button><button type="button" aria-label={`${tab.request.name} 탭 닫기`} onClick={() => closeTab(tab.id)}>×</button></div>)}
            <button type="button" className="api-new-tab-button" aria-label="새 API 요청 탭" onClick={() => addTab()}>+</button>
          </div>

          <div className="api-request-line">
            <select value={activeRequest.method} aria-label="HTTP Method" className={`method-${activeRequest.method.toLowerCase()}`} onChange={(event) => updateActiveRequest({ ...activeRequest, method: event.target.value as ApiWorkspaceMethod })}>{methods.map((method) => <option key={method}>{method}</option>)}</select>
            <input value={activeRequest.url} aria-label="Request URL" placeholder="https://api.example.com/resources" onKeyDown={(event) => { if (event.key === "Enter") void executeRequest(); }} onChange={(event) => updateActiveRequest({ ...activeRequest, url: event.target.value })} />
            {isSending ? <button type="button" className="danger-button" onClick={() => abortControllerReference.current?.abort("USER_CANCELLED")}>Cancel</button> : <button type="button" onClick={() => void executeRequest()}>Send <span>↵</span></button>}
            <button type="button" className="secondary-button" onClick={openSaveDialog}>Save</button>
          </div>

          <div className="api-request-options">
            <span className="api-active-environment">현재 환경 <strong>{environments.find((environment) => environment.id === activeEnvironmentId)?.name ?? "없음"}</strong></span>
            <label>Timeout <select value={activeRequest.timeoutMilliseconds} onChange={(event) => updateActiveRequest({ ...activeRequest, timeoutMilliseconds: Number(event.target.value) })}><option value={3000}>3초</option><option value={10000}>10초</option><option value={30000}>30초</option><option value={60000}>60초</option></select></label>
            <label><input type="checkbox" checked={activeRequest.privateExecution} onChange={(event) => updateActiveRequest({ ...activeRequest, privateExecution: event.target.checked })} />비공개 실행</label>
            <label title="민감한 응답이 저장될 수 있으므로 기본값은 OFF입니다."><input type="checkbox" checked={activeRequest.saveResponseBody} disabled={activeRequest.privateExecution} onChange={(event) => updateActiveRequest({ ...activeRequest, saveResponseBody: event.target.checked })} />Response Body 저장</label>
            <button type="button" className="ghost-button" onClick={() => setCodeDialogOpen(true)}>cURL · Code</button>
          </div>

          <div className={`api-workspace-panels ${splitView === "SIDE_BY_SIDE" ? "side-by-side" : "stacked"}`}>
            <ApiWorkspaceRequestEditor request={activeRequest} activeSection={requestSection} onSectionChange={setRequestSection} onRequestChange={updateActiveRequest} />
            <ApiWorkspaceResponseViewer response={response} actualRequest={actualRequest} errorMessage={requestError} isSending={isSending} activeSection={responseSection} bodyView={responseBodyView} onSectionChange={setResponseSection} onBodyViewChange={setResponseBodyView} onCopy={() => void copyResponse()} onDownload={downloadResponse} />
          </div>
        </main>
        </div>
      </div>

      <ModalDialog isOpen={helpOpen} title="API Workspace 도움말" description="브라우저에서 안전하게 API 요청 흐름을 연습합니다." size="large" onRequestClose={() => setHelpOpen(false)}>
        <ApiToolGuide currentTool="WORKSPACE" />
        <div className="api-help-grid"><article><span>1</span><div><h3>요청 작성</h3><p>Method와 URL을 입력하고 Params, Authorization, Headers, Body를 필요한 만큼 설정합니다.</p></div></article><article><span>2</span><div><h3>실행과 취소</h3><p>Send 또는 Enter로 전송합니다. 실행 중에는 Cancel로 요청을 중단할 수 있습니다.</p></div></article><article><span>3</span><div><h3>응답과 Actual Request</h3><p>응답 상태·시간·크기와 환경변수 치환 후 실제 전송 구성을 함께 비교합니다.</p></div></article><article><span>4</span><div><h3>Collection 디렉터리</h3><p>요청을 검색·복제하고 Collection과 Folder의 이름·구조를 관리합니다.</p></div></article><article><span>5</span><div><h3>다른 도구와 공유</h3><p>Postman Collection v2.1·Environment JSON을 가져오거나 내보내고, 단일 요청은 cURL로 주고받습니다.</p></div></article><article><span>6</span><div><h3>Collection Runner</h3><p>Collection 요청을 반복·간격 설정으로 순차 실행하고 매일 예약과 최근 실행 결과를 관리합니다.</p></div></article></div><div className="api-help-warning"><strong>주의사항</strong><ul><li>CORS가 허용되지 않은 외부 API는 브라우저에서 호출할 수 없습니다.</li><li>Secret과 파일은 열린 탭 복구·History·저장 요청에 원문으로 남기지 않습니다.</li><li>Actual Request에서도 Authorization·API Key·민감 Header 값은 마스킹합니다.</li><li>Postman 내보내기는 Secret을 자리표시자 또는 빈 값으로 바꾸므로 대상 도구에서 다시 설정해야 합니다.</li><li>예약 실행은 API Workspace 페이지가 열려 있을 때 동작하며, 놓친 일정은 다시 열 때 1회 실행합니다.</li><li>Response Body 저장은 기본 OFF이며 민감한 응답은 저장하지 않는 것이 안전합니다.</li></ul></div>
      </ModalDialog>

      <ModalDialog isOpen={codeDialogOpen} title="cURL 가져오기 · 코드 생성" description="현재 요청을 코드로 만들거나 cURL 명령을 현재 탭에 불러옵니다. Secret 원문은 생성 코드에 포함하지 않습니다." size="large" onRequestClose={() => setCodeDialogOpen(false)}>
        <div className="api-code-dialog">
          <section><header><h3>현재 요청 코드 생성</h3><select value={codeTarget} onChange={(event) => setCodeTarget(event.target.value as ApiCodeTarget)}><option value="CURL">cURL</option><option value="FETCH">JavaScript Fetch</option><option value="AXIOS">JavaScript Axios</option><option value="JAVA">Java HttpClient</option></select></header><textarea readOnly value={generatedRequestCode} spellCheck={false} aria-label="생성된 API 요청 코드" /><button type="button" onClick={() => void copyText(generatedRequestCode).then(() => applicationNotification.success("요청 코드를 복사했습니다."))}>코드 복사</button></section>
          <section><header><h3>cURL에서 요청 가져오기</h3></header><textarea value={curlImportText} spellCheck={false} aria-label="가져올 cURL 명령" placeholder={'curl -X POST "http://localhost:8080/api/v1/..." -H "Content-Type: application/json" -d \'{"name":"DevNote"}\''} onChange={(event) => { setCurlImportText(event.target.value); setCurlWarnings([]); }} />{curlWarnings.length > 0 ? <ul className="api-curl-warnings">{curlWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}<button type="button" disabled={!curlImportText.trim()} onClick={() => { try { const parsed = parseCurlRequest(curlImportText); updateActiveRequest({ ...parsed.request, id: activeRequest.id, name: activeRequest.name }); setCurlWarnings(parsed.warnings); applicationNotification.success("cURL 요청을 현재 탭에 불러왔습니다."); } catch (error) { applicationNotification.warning(error instanceof Error ? error.message : "cURL을 해석하지 못했습니다."); } }}>현재 탭에 가져오기</button></section>
        </div>
      </ModalDialog>

      <ApiWorkspaceInterchangeDialog
        isOpen={interchangeDialogOpen}
        authenticated={Boolean(authenticatedMemberId)}
        collections={collections}
        folders={folders}
        savedRequests={savedRequests}
        environments={environments}
        onRequestClose={() => setInterchangeDialogOpen(false)}
        onCollectionImport={(result) => {
          setCollections((currentCollections) => [...currentCollections, result.collection]);
          setFolders((currentFolders) => [...currentFolders, ...result.folders]);
          setSavedRequests((currentRequests) => [...currentRequests, ...result.savedRequests]);
          setActivePanel("COLLECTIONS");
        }}
        onEnvironmentImport={(result) => {
          setEnvironments((currentEnvironments) => [...currentEnvironments, result.environment]);
          setActiveEnvironmentId(result.environment.id);
          setActivePanel("ENVIRONMENTS");
        }}
        onCurlShareOpen={() => { setInterchangeDialogOpen(false); setCodeDialogOpen(true); }}
      />

      <ApiCollectionRunnerDialog
        isOpen={collectionRunnerOpen}
        authenticated={Boolean(authenticatedMemberId)}
        storagePrefix={storagePrefix}
        defaultCollectionId={runnerDefaultCollectionId}
        defaultEnvironmentId={activeEnvironmentId}
        collections={collections}
        savedRequests={savedRequests}
        environments={environments}
        onRequestClose={() => setCollectionRunnerOpen(false)}
      />

      <ModalDialog isOpen={saveDialogOpen} title="요청 저장" description="현재 요청을 Collection 또는 Folder에 저장합니다." onRequestClose={() => setSaveDialogOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setSaveDialogOpen(false)}>취소</button><button type="button" disabled={!saveName.trim() || !saveCollectionId} onClick={saveCurrentRequest}>저장</button></>}>
        <div className="modal-form-grid"><label>요청 이름<input autoFocus value={saveName} onChange={(event) => setSaveName(event.target.value)} /></label><label>설명<textarea rows={3} value={saveDescription} onChange={(event) => setSaveDescription(event.target.value)} /></label><label>Collection<select value={saveCollectionId} onChange={(event) => { setSaveCollectionId(event.target.value); setSaveFolderId(""); }}>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label><label>Folder<select value={saveFolderId} onChange={(event) => setSaveFolderId(event.target.value)}><option value="">Folder 없음</option>{availableFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><p className="api-secret-note">Secret 값과 form-data 파일은 저장하지 않습니다.</p></div>
      </ModalDialog>

      <ModalDialog isOpen={collectionDialogOpen} title="Collection 만들기" description={resumeSaveAfterCollectionCreate ? "Collection을 만든 뒤 현재 요청 저장을 이어갑니다." : "관련 API 요청을 하나의 실행·관리 단위로 모읍니다."} onRequestClose={() => { setCollectionDialogOpen(false); setResumeSaveAfterCollectionCreate(false); }} footer={<><button type="button" className="ghost-button" onClick={() => { setCollectionDialogOpen(false); setResumeSaveAfterCollectionCreate(false); }}>취소</button><button type="button" disabled={!collectionName.trim()} onClick={createCollection}>만들기</button></>}><div className="modal-form-grid"><label>Collection 이름<input autoFocus value={collectionName} onChange={(event) => setCollectionName(event.target.value)} /></label><label>설명<textarea rows={3} value={collectionDescription} placeholder="이 Collection에서 관리할 API 범위를 적어 주세요." onChange={(event) => setCollectionDescription(event.target.value)} /></label></div></ModalDialog>
      <ModalDialog isOpen={Boolean(collectionRenameTargetId)} title="Collection 이름 변경" description="저장 요청과 Folder 구조는 그대로 유지됩니다." onRequestClose={() => setCollectionRenameTargetId(undefined)} footer={<><button type="button" className="ghost-button" onClick={() => setCollectionRenameTargetId(undefined)}>취소</button><button type="button" disabled={!collectionRenameName.trim()} onClick={renameCollection}>변경</button></>}><label>Collection 이름<input autoFocus value={collectionRenameName} onChange={(event) => setCollectionRenameName(event.target.value)} /></label></ModalDialog>
      <ModalDialog isOpen={Boolean(folderCollectionId)} title="Folder 만들기" description="Collection 안에서 요청을 한 번 더 분류합니다." onRequestClose={() => setFolderCollectionId(undefined)} footer={<><button type="button" className="ghost-button" onClick={() => setFolderCollectionId(undefined)}>취소</button><button type="button" disabled={!folderName.trim()} onClick={createFolder}>만들기</button></>}><label>Folder 이름<input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} /></label></ModalDialog>
      <ModalDialog isOpen={Boolean(folderRenameTargetId)} title="Folder 이름 변경" description="Folder에 포함된 요청은 그대로 유지됩니다." onRequestClose={() => setFolderRenameTargetId(undefined)} footer={<><button type="button" className="ghost-button" onClick={() => setFolderRenameTargetId(undefined)}>취소</button><button type="button" disabled={!folderRenameName.trim()} onClick={renameFolder}>변경</button></>}><label>Folder 이름<input autoFocus value={folderRenameName} onChange={(event) => setFolderRenameName(event.target.value)} /></label></ModalDialog>
      <ModalDialog isOpen={Boolean(moveSavedRequestTargetId)} title="저장 요청 이동" description={`${moveSavedRequestTarget?.name ?? "선택한 요청"} 요청을 다른 Collection 또는 Folder로 이동합니다.`} onRequestClose={() => setMoveSavedRequestTargetId(undefined)} footer={<><button type="button" className="ghost-button" onClick={() => setMoveSavedRequestTargetId(undefined)}>취소</button><button type="button" disabled={!moveCollectionId} onClick={moveSavedRequest}>이동</button></>}><div className="modal-form-grid"><label>Collection<select value={moveCollectionId} onChange={(event) => { setMoveCollectionId(event.target.value); setMoveFolderId(""); }}>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label><label>Folder<select value={moveFolderId} onChange={(event) => setMoveFolderId(event.target.value)}><option value="">Collection 최상위</option>{availableMoveFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label></div></ModalDialog>
      <ModalDialog isOpen={environmentDialogOpen} title="Environment 만들기" description="Local·Development처럼 API 실행 환경을 구분합니다." onRequestClose={() => setEnvironmentDialogOpen(false)} footer={<><button type="button" className="ghost-button" onClick={() => setEnvironmentDialogOpen(false)}>취소</button><button type="button" disabled={!environmentName.trim()} onClick={createEnvironment}>만들기</button></>}><label>Environment 이름<input autoFocus value={environmentName} placeholder="Local" onChange={(event) => setEnvironmentName(event.target.value)} /></label></ModalDialog>
      <ConfirmDialog isOpen={clearHistoryConfirmOpen} title="전체 History 삭제" description={`${historyItems.length}개의 실행 이력을 모두 삭제합니다. 삭제 직후 알림에서 되돌릴 수 있습니다.`} confirmButtonLabel="전체 삭제" onConfirm={() => { deleteHistoryItems(new Set(historyItems.map((historyItem) => historyItem.id))); setClearHistoryConfirmOpen(false); }} onCancel={() => setClearHistoryConfirmOpen(false)} />
      <ConfirmDialog isOpen={Boolean(environmentDeleteTargetId)} title="Environment 삭제" description="환경과 변수 설정을 삭제합니다. 이 환경을 참조하는 요청의 {{변수}}는 더 이상 치환되지 않습니다." confirmButtonLabel="삭제" onConfirm={() => { if (environmentDeleteTargetId) setEnvironments((currentEnvironments) => currentEnvironments.filter((environment) => environment.id !== environmentDeleteTargetId)); if (activeEnvironmentId === environmentDeleteTargetId) setActiveEnvironmentId(undefined); setEnvironmentDeleteTargetId(undefined); }} onCancel={() => setEnvironmentDeleteTargetId(undefined)} />
      <ConfirmDialog isOpen={Boolean(collectionDeleteTargetId)} title="Collection 삭제" description="Collection과 Folder를 삭제하고 포함된 저장 요청은 휴지통으로 이동합니다. 열린 요청 탭은 닫히지 않습니다." confirmButtonLabel="삭제" onConfirm={deleteCollection} onCancel={() => setCollectionDeleteTargetId(undefined)} />
      <ConfirmDialog isOpen={Boolean(folderDeleteTargetId)} title="Folder 삭제" description="Folder를 삭제하고 포함된 저장 요청은 Collection 최상위로 이동합니다." confirmButtonLabel="삭제" onConfirm={deleteFolder} onCancel={() => setFolderDeleteTargetId(undefined)} />
      <ConfirmDialog isOpen={Boolean(savedRequestPermanentDeleteTargetId)} title="저장 요청 완전 삭제" description="휴지통의 저장 요청을 완전히 삭제합니다. 이 작업은 실행 취소할 수 없습니다." confirmButtonLabel="완전 삭제" onConfirm={() => { if (savedRequestPermanentDeleteTargetId) setSavedRequests((currentRequests) => currentRequests.filter((savedRequest) => savedRequest.id !== savedRequestPermanentDeleteTargetId)); setSavedRequestPermanentDeleteTargetId(undefined); }} onCancel={() => setSavedRequestPermanentDeleteTargetId(undefined)} />
      <ConfirmDialog isOpen={Boolean(closeTabTargetId)} title="저장하지 않은 탭 닫기" description="작성 중인 변경사항이 있습니다. 이 탭을 닫으면 Secret과 저장되지 않은 입력을 복구할 수 없습니다." confirmButtonLabel="저장하지 않고 닫기" onConfirm={() => closeTabTargetId && closeTab(closeTabTargetId, true)} onCancel={() => setCloseTabTargetId(undefined)} />
    </section>
  );
};
