import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  ApiCollectionRun,
  ApiCollectionRunRequestResult,
  ApiCollectionSchedule,
  ApiWorkspaceCollection,
  ApiWorkspaceEnvironment,
  ApiWorkspaceSavedRequest,
} from "@/features/utility/types/apiWorkspaceTypes";
import {
  API_COLLECTION_RUN_HISTORY_LIMIT,
  calculateNextDailyRun,
  parseStoredCollectionRuns,
  parseStoredCollectionSchedules,
} from "@/features/utility/utils/apiCollectionRunnerUtils";
import { executeApiWorkspaceRequest } from "@/features/utility/utils/apiWorkspaceExecutor";
import { createWorkspaceId } from "@/features/utility/utils/apiWorkspaceUtils";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ModalDialog } from "@/shared/ui/ModalDialog";

type RunnerView = "RUN" | "SCHEDULES" | "HISTORY";

interface RunnerConfiguration {
  collectionId: string;
  environmentId?: string;
  selectedRequestIds: string[];
  iterationCount: number;
  delayMilliseconds: number;
}

interface ApiCollectionRunnerDialogProps {
  isOpen: boolean;
  authenticated: boolean;
  storagePrefix: string;
  defaultCollectionId?: string;
  defaultEnvironmentId?: string;
  collections: ApiWorkspaceCollection[];
  savedRequests: ApiWorkspaceSavedRequest[];
  environments: ApiWorkspaceEnvironment[];
  onRequestClose: () => void;
  executeRequest?: typeof executeApiWorkspaceRequest;
}

const formatDateTime = (dateValue?: string): string => {
  if (!dateValue) return "없음";
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return "확인 필요";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(parsedDate);
};

const waitForDelay = (delayMilliseconds: number, signal: AbortSignal): Promise<void> => new Promise((resolve) => {
  if (delayMilliseconds <= 0 || signal.aborted) {
    resolve();
    return;
  }
  const timeoutId = window.setTimeout(() => {
    signal.removeEventListener("abort", handleAbort);
    resolve();
  }, delayMilliseconds);
  function handleAbort(): void {
    window.clearTimeout(timeoutId);
    resolve();
  }
  signal.addEventListener("abort", handleAbort, { once: true });
});

export const ApiCollectionRunnerDialog = ({
  isOpen,
  authenticated,
  storagePrefix,
  defaultCollectionId,
  defaultEnvironmentId,
  collections,
  savedRequests,
  environments,
  onRequestClose,
  executeRequest = executeApiWorkspaceRequest,
}: ApiCollectionRunnerDialogProps) => {
  const [activeView, setActiveView] = useState<RunnerView>("RUN");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  const [iterationCount, setIterationCount] = useState(1);
  const [delayMilliseconds, setDelayMilliseconds] = useState(0);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleTime, setScheduleTime] = useState("02:00");
  const [editingScheduleId, setEditingScheduleId] = useState<string>();
  const [schedules, setSchedules] = useState<ApiCollectionSchedule[]>([]);
  const [runHistory, setRunHistory] = useState<ApiCollectionRun[]>([]);
  const [activeRun, setActiveRun] = useState<ApiCollectionRun>();
  const [loadedStoragePrefix, setLoadedStoragePrefix] = useState<string>();
  const runnerAbortReference = useRef<AbortController | null>(null);
  const runnerBusyReference = useRef(false);
  const pendingRequestSelectionReference = useRef<string[] | undefined>(undefined);
  const runnerStoragePrefixReference = useRef(storagePrefix);

  const activeCollectionRequests = useMemo(
    () => savedRequests.filter((savedRequest) => savedRequest.collectionId === selectedCollectionId && !savedRequest.deletedAt),
    [savedRequests, selectedCollectionId],
  );

  useEffect(() => {
    if (runnerStoragePrefixReference.current !== storagePrefix) {
      runnerAbortReference.current?.abort("MEMBER_SCOPE_CHANGED");
      setActiveRun(undefined);
    }
    runnerStoragePrefixReference.current = storagePrefix;
    if (!authenticated) {
      setSchedules([]);
      setRunHistory([]);
      setLoadedStoragePrefix(storagePrefix);
      return;
    }
    setSchedules(parseStoredCollectionSchedules(localStorage.getItem(`${storagePrefix}:runner-schedules`)));
    setRunHistory(parseStoredCollectionRuns(localStorage.getItem(`${storagePrefix}:runner-history`)));
    setLoadedStoragePrefix(storagePrefix);
  }, [authenticated, storagePrefix]);

  useEffect(() => {
    if (!authenticated || loadedStoragePrefix !== storagePrefix) return;
    localStorage.setItem(`${storagePrefix}:runner-schedules`, JSON.stringify(schedules));
    localStorage.setItem(`${storagePrefix}:runner-history`, JSON.stringify(runHistory.slice(0, API_COLLECTION_RUN_HISTORY_LIMIT)));
  }, [authenticated, loadedStoragePrefix, runHistory, schedules, storagePrefix]);

  useEffect(() => {
    if (collections.some((collection) => collection.id === selectedCollectionId)) return;
    setSelectedCollectionId(collections[0]?.id ?? "");
  }, [collections, selectedCollectionId]);

  useEffect(() => {
    if (!isOpen || !defaultCollectionId || !collections.some((collection) => collection.id === defaultCollectionId)) return;
    setSelectedCollectionId(defaultCollectionId);
  }, [collections, defaultCollectionId, isOpen]);

  useEffect(() => {
    const pendingRequestIds = pendingRequestSelectionReference.current;
    pendingRequestSelectionReference.current = undefined;
    setSelectedRequestIds(new Set(pendingRequestIds ?? activeCollectionRequests.map((savedRequest) => savedRequest.id)));
  }, [activeCollectionRequests]);

  useEffect(() => {
    if (!selectedEnvironmentId && defaultEnvironmentId) setSelectedEnvironmentId(defaultEnvironmentId);
  }, [defaultEnvironmentId, selectedEnvironmentId]);

  const runCollection = useCallback(async (
    configuration: RunnerConfiguration,
    trigger: ApiCollectionRun["trigger"],
    scheduleId?: string,
  ): Promise<void> => {
    if (runnerBusyReference.current) {
      if (trigger === "MANUAL") applicationNotification.warning("다른 Collection이 실행 중입니다.");
      return;
    }

    const collection = collections.find((candidate) => candidate.id === configuration.collectionId);
    const environment = environments.find((candidate) => candidate.id === configuration.environmentId);
    const selectedIdSet = new Set(configuration.selectedRequestIds);
    const requests = savedRequests.filter((savedRequest) => (
      savedRequest.collectionId === configuration.collectionId
      && !savedRequest.deletedAt
      && selectedIdSet.has(savedRequest.id)
    ));
    if (!collection || requests.length === 0) {
      if (trigger === "MANUAL") applicationNotification.warning("실행할 저장 요청을 선택해 주세요.");
      if (scheduleId) {
        const failedAt = new Date().toISOString();
        setSchedules((currentSchedules) => currentSchedules.map((schedule) => schedule.id === scheduleId ? {
          ...schedule,
          lastRunAt: failedAt,
          lastRunStatus: "COMPLETED",
          lastRunSuccessful: false,
        } : schedule));
        applicationNotification.warning("예약 실행을 시작하지 못했습니다.", collection ? "실행할 저장 요청이 없습니다." : "Collection이 삭제되었습니다.");
      }
      return;
    }

    runnerBusyReference.current = true;
    const executionStoragePrefix = storagePrefix;
    const runnerAbortController = new AbortController();
    runnerAbortReference.current = runnerAbortController;
    const startedAt = new Date().toISOString();
    const totalRequestCount = requests.length * configuration.iterationCount;
    const runningResult: ApiCollectionRun = {
      id: createWorkspaceId(),
      collectionId: collection.id,
      collectionName: collection.name,
      environmentName: environment?.name,
      scheduleId,
      trigger,
      status: "RUNNING",
      startedAt,
      totalRequestCount,
      completedRequestCount: 0,
      results: [],
    };
    setActiveRun(runningResult);

    const completedResults: ApiCollectionRunRequestResult[] = [];
    for (let iteration = 1; iteration <= configuration.iterationCount; iteration += 1) {
      for (const savedRequest of requests) {
        if (runnerAbortController.signal.aborted) break;

        const requestAbortController = new AbortController();
        const handleRunnerAbort = (): void => requestAbortController.abort("USER_CANCELLED");
        runnerAbortController.signal.addEventListener("abort", handleRunnerAbort, { once: true });
        const timeoutId = window.setTimeout(
          () => requestAbortController.abort("TIMEOUT"),
          savedRequest.request.timeoutMilliseconds,
        );
        const requestStartedAt = performance.now();
        let result: ApiCollectionRunRequestResult;
        try {
          const requestResponse = await executeRequest(
            savedRequest.request,
            environment?.variables ?? [],
            requestAbortController.signal,
          );
          result = {
            id: createWorkspaceId(),
            savedRequestId: savedRequest.id,
            requestName: savedRequest.name,
            method: savedRequest.request.method,
            iteration,
            responseStatus: requestResponse.status,
            responseTimeMilliseconds: requestResponse.elapsedMilliseconds,
            successful: requestResponse.status >= 200 && requestResponse.status < 400,
          };
        } catch (requestFailure) {
          const timeout = requestAbortController.signal.reason === "TIMEOUT";
          const cancelled = runnerAbortController.signal.aborted;
          result = {
            id: createWorkspaceId(),
            savedRequestId: savedRequest.id,
            requestName: savedRequest.name,
            method: savedRequest.request.method,
            iteration,
            responseTimeMilliseconds: Math.round(performance.now() - requestStartedAt),
            successful: false,
            errorMessage: timeout
              ? `제한 시간 ${savedRequest.request.timeoutMilliseconds / 1000}초를 초과했습니다.`
              : cancelled
                ? "실행을 취소했습니다."
                : requestFailure instanceof Error ? requestFailure.message : "요청 실행 중 오류가 발생했습니다.",
          };
        } finally {
          window.clearTimeout(timeoutId);
          runnerAbortController.signal.removeEventListener("abort", handleRunnerAbort);
        }

        completedResults.push(result);
        if (runnerStoragePrefixReference.current === executionStoragePrefix) {
          setActiveRun((currentRun) => currentRun ? {
            ...currentRun,
            completedRequestCount: completedResults.length,
            results: [...completedResults],
          } : currentRun);
        }

        const isLastRequest = completedResults.length >= totalRequestCount;
        if (!isLastRequest) await waitForDelay(configuration.delayMilliseconds, runnerAbortController.signal);
      }
      if (runnerAbortController.signal.aborted) break;
    }

    const finalStatus: ApiCollectionRun["status"] = runnerAbortController.signal.aborted ? "CANCELLED" : "COMPLETED";
    const finishedRun: ApiCollectionRun = {
      ...runningResult,
      status: finalStatus,
      finishedAt: new Date().toISOString(),
      completedRequestCount: completedResults.length,
      results: completedResults,
    };
    if (runnerStoragePrefixReference.current !== executionStoragePrefix) {
      runnerAbortReference.current = null;
      runnerBusyReference.current = false;
      return;
    }
    setActiveRun(finishedRun);
    setRunHistory((currentHistory) => [finishedRun, ...currentHistory].slice(0, API_COLLECTION_RUN_HISTORY_LIMIT));
    if (scheduleId) {
      const runSuccessful = completedResults.length === totalRequestCount && completedResults.every((result) => result.successful);
      setSchedules((currentSchedules) => currentSchedules.map((schedule) => schedule.id === scheduleId ? {
        ...schedule,
        lastRunAt: finishedRun.finishedAt,
        lastRunStatus: finalStatus,
        lastRunSuccessful: runSuccessful,
      } : schedule));
      if (runSuccessful) applicationNotification.success(`예약 실행 완료: ${collection.name}`);
      else applicationNotification.warning(`예약 실행 확인 필요: ${collection.name}`, "실행 이력에서 실패 요청을 확인해 주세요.");
    }
    runnerAbortReference.current = null;
    runnerBusyReference.current = false;
  }, [collections, environments, executeRequest, savedRequests, storagePrefix]);

  useEffect(() => {
    if (!authenticated || loadedStoragePrefix !== storagePrefix) return;
    const runDueSchedule = (): void => {
      if (runnerBusyReference.current) return;
      const now = new Date();
      const dueSchedule = schedules.find((schedule) => schedule.enabled && new Date(schedule.nextRunAt).getTime() <= now.getTime());
      if (!dueSchedule) return;

      setSchedules((currentSchedules) => currentSchedules.map((schedule) => schedule.id === dueSchedule.id ? {
        ...schedule,
        nextRunAt: calculateNextDailyRun(schedule.localTime, now),
        updatedAt: now.toISOString(),
      } : schedule));
      void runCollection({
        collectionId: dueSchedule.collectionId,
        environmentId: dueSchedule.environmentId,
        selectedRequestIds: dueSchedule.selectedRequestIds,
        iterationCount: dueSchedule.iterationCount,
        delayMilliseconds: dueSchedule.delayMilliseconds,
      }, "SCHEDULED", dueSchedule.id);
    };

    runDueSchedule();
    const intervalId = window.setInterval(runDueSchedule, 30_000);
    return () => window.clearInterval(intervalId);
  }, [authenticated, loadedStoragePrefix, runCollection, schedules, storagePrefix]);

  useEffect(() => () => runnerAbortReference.current?.abort("COMPONENT_UNMOUNTED"), []);

  const currentConfiguration = (): RunnerConfiguration => ({
    collectionId: selectedCollectionId,
    environmentId: selectedEnvironmentId || undefined,
    selectedRequestIds: [...selectedRequestIds],
    iterationCount,
    delayMilliseconds,
  });

  const resetScheduleForm = (): void => {
    setEditingScheduleId(undefined);
    setScheduleName("");
    setScheduleTime("02:00");
  };

  const saveSchedule = (): void => {
    if (!scheduleName.trim() || !selectedCollectionId || selectedRequestIds.size === 0) return;
    const now = new Date();
    const commonValues = {
      name: scheduleName.trim(),
      collectionId: selectedCollectionId,
      environmentId: selectedEnvironmentId || undefined,
      selectedRequestIds: [...selectedRequestIds],
      localTime: scheduleTime,
      iterationCount,
      delayMilliseconds,
      updatedAt: now.toISOString(),
      nextRunAt: calculateNextDailyRun(scheduleTime, now),
    };
    if (editingScheduleId) {
      setSchedules((currentSchedules) => currentSchedules.map((schedule) => schedule.id === editingScheduleId ? { ...schedule, ...commonValues } : schedule));
      applicationNotification.success("예약 실행을 수정했습니다.");
    } else {
      setSchedules((currentSchedules) => [...currentSchedules, {
        id: createWorkspaceId(),
        ...commonValues,
        enabled: true,
        createdAt: now.toISOString(),
      }]);
      applicationNotification.success("매일 예약 실행을 등록했습니다.");
    }
    resetScheduleForm();
  };

  const editSchedule = (schedule: ApiCollectionSchedule): void => {
    setEditingScheduleId(schedule.id);
    setScheduleName(schedule.name);
    setScheduleTime(schedule.localTime);
    if (schedule.collectionId !== selectedCollectionId) pendingRequestSelectionReference.current = schedule.selectedRequestIds;
    setSelectedCollectionId(schedule.collectionId);
    setSelectedEnvironmentId(schedule.environmentId ?? "");
    setSelectedRequestIds(new Set(schedule.selectedRequestIds));
    setIterationCount(schedule.iterationCount);
    setDelayMilliseconds(schedule.delayMilliseconds);
  };

  const deleteSchedule = (scheduleId: string): void => {
    const deletedSchedule = schedules.find((schedule) => schedule.id === scheduleId);
    if (!deletedSchedule) return;
    setSchedules((currentSchedules) => currentSchedules.filter((schedule) => schedule.id !== scheduleId));
    toast.success("예약 실행을 삭제했습니다.", {
      action: { label: "실행 취소", onClick: () => setSchedules((currentSchedules) => [...currentSchedules, deletedSchedule]) },
    });
  };

  const renderRequestSelection = () => (
    <fieldset className="api-runner-request-fieldset">
      <legend>실행할 요청 <span>{selectedRequestIds.size}/{activeCollectionRequests.length}</span></legend>
      <div className="api-runner-selection-actions">
        <button type="button" className="ghost-button" onClick={() => setSelectedRequestIds(new Set(activeCollectionRequests.map((request) => request.id)))}>전체 선택</button>
        <button type="button" className="ghost-button" onClick={() => setSelectedRequestIds(new Set())}>전체 해제</button>
      </div>
      {activeCollectionRequests.length === 0 ? <p className="api-runner-empty-copy">이 Collection에 저장된 요청이 없습니다.</p> : (
        <div className="api-runner-request-list">
          {activeCollectionRequests.map((savedRequest) => (
            <label key={savedRequest.id}>
              <input type="checkbox" checked={selectedRequestIds.has(savedRequest.id)} onChange={(event) => setSelectedRequestIds((currentIds) => {
                const nextIds = new Set(currentIds);
                if (event.target.checked) nextIds.add(savedRequest.id);
                else nextIds.delete(savedRequest.id);
                return nextIds;
              })} />
              <span className={`method-${savedRequest.request.method.toLowerCase()}`}>{savedRequest.request.method}</span>
              <strong>{savedRequest.name}</strong>
              <small>{savedRequest.request.url}</small>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );

  const renderConfiguration = () => (
    <>
      <div className="api-runner-config-grid">
        <label>Collection<select value={selectedCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)}><option value="">선택</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>
        <label>Environment<select value={selectedEnvironmentId} onChange={(event) => setSelectedEnvironmentId(event.target.value)}><option value="">환경 없음</option>{environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}</select></label>
        <label>반복 횟수<input type="number" min={1} max={10} value={iterationCount} onChange={(event) => setIterationCount(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} /></label>
        <label>요청 간격<select value={delayMilliseconds} onChange={(event) => setDelayMilliseconds(Number(event.target.value))}><option value={0}>없음</option><option value={500}>0.5초</option><option value={1000}>1초</option><option value={3000}>3초</option><option value={5000}>5초</option><option value={10000}>10초</option></select></label>
      </div>
      {renderRequestSelection()}
    </>
  );

  const renderRunProgress = () => {
    if (!activeRun) return null;
    const successCount = activeRun.results.filter((result) => result.successful).length;
    const progress = activeRun.totalRequestCount > 0 ? Math.round((activeRun.completedRequestCount / activeRun.totalRequestCount) * 100) : 0;
    return (
      <section className="api-runner-progress" aria-live="polite">
        <header><div><strong>{activeRun.collectionName}</strong><span className={`api-run-status ${activeRun.status.toLowerCase()}`}>{activeRun.status === "RUNNING" ? "실행 중" : activeRun.status === "CANCELLED" ? "취소됨" : "완료"}</span></div><span>{activeRun.completedRequestCount}/{activeRun.totalRequestCount}</span></header>
        <div className="api-runner-progress-track"><span style={{ width: `${progress}%` }} /></div>
        <p>성공 {successCount} · 실패 {activeRun.results.length - successCount}</p>
        <div className="api-runner-result-list">
          {activeRun.results.map((result) => <div key={result.id} className={result.successful ? "success" : "failure"}><span className={`method-${result.method.toLowerCase()}`}>{result.method}</span><strong>{result.requestName}</strong><small>{result.iteration}회차</small><b>{result.responseStatus ?? "ERR"}</b><time>{result.responseTimeMilliseconds}ms</time>{result.errorMessage ? <p>{result.errorMessage}</p> : null}</div>)}
        </div>
      </section>
    );
  };

  return (
    <ModalDialog isOpen={isOpen} title="Collection Runner" description="Collection의 저장 요청을 순서대로 실행하고, 매일 지정 시각의 예약 실행을 관리합니다." size="large" closeOnBackdropClick={!runnerBusyReference.current} onRequestClose={onRequestClose}>
      {!authenticated ? <div className="api-runner-login-required"><strong>로그인이 필요합니다.</strong><p>Collection, 예약 설정, 실행 이력은 회원별 브라우저 저장소에 보관됩니다.</p></div> : (
        <div className="api-collection-runner">
          <div className="api-runner-mode-tabs" role="tablist" aria-label="Collection Runner 메뉴">
            <button type="button" role="tab" aria-selected={activeView === "RUN"} className={activeView === "RUN" ? "active" : undefined} onClick={() => setActiveView("RUN")}>즉시 실행</button>
            <button type="button" role="tab" aria-selected={activeView === "SCHEDULES"} className={activeView === "SCHEDULES" ? "active" : undefined} onClick={() => setActiveView("SCHEDULES")}>예약 실행 <span>{schedules.filter((schedule) => schedule.enabled).length}</span></button>
            <button type="button" role="tab" aria-selected={activeView === "HISTORY"} className={activeView === "HISTORY" ? "active" : undefined} onClick={() => setActiveView("HISTORY")}>실행 이력 <span>{runHistory.length}</span></button>
          </div>

          {activeView === "RUN" ? <section className="api-runner-view">
            <div className="api-runner-section-heading"><div><h3>Run configuration</h3><p>선택한 요청을 Collection 순서대로 실행합니다.</p></div>{runnerBusyReference.current ? <button type="button" className="danger-button" onClick={() => runnerAbortReference.current?.abort("USER_CANCELLED")}>실행 중지</button> : <button type="button" disabled={!selectedCollectionId || selectedRequestIds.size === 0} onClick={() => void runCollection(currentConfiguration(), "MANUAL")}>Collection 실행</button>}</div>
            {renderConfiguration()}
            {renderRunProgress()}
          </section> : null}

          {activeView === "SCHEDULES" ? <section className="api-runner-view">
            <div className="api-runner-browser-notice"><span>◷</span><div><strong>브라우저 예약 실행</strong><p>API Workspace 페이지가 열려 있을 때 동작합니다. 절전·종료 중 놓친 일정은 페이지를 다시 열면 한 번 실행하며, Secret 변수는 다시 입력해야 할 수 있습니다.</p></div></div>
            <div className="api-runner-section-heading"><div><h3>{editingScheduleId ? "예약 수정" : "매일 예약 만들기"}</h3><p>브라우저의 현재 시간대를 기준으로 실행합니다.</p></div></div>
            <div className="api-runner-schedule-heading">
              <label>예약 이름<input value={scheduleName} placeholder="매일 API 상태 점검" onChange={(event) => setScheduleName(event.target.value)} /></label>
              <label>매일 실행 시각<input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} /></label>
            </div>
            {renderConfiguration()}
            <div className="api-runner-form-actions">{editingScheduleId ? <button type="button" className="ghost-button" onClick={resetScheduleForm}>수정 취소</button> : null}<button type="button" disabled={!scheduleName.trim() || !selectedCollectionId || selectedRequestIds.size === 0} onClick={saveSchedule}>{editingScheduleId ? "예약 수정" : "예약 등록"}</button></div>

            <div className="api-runner-schedule-list">
              <h3>등록된 예약 <span>{schedules.length}</span></h3>
              {schedules.length === 0 ? <p className="api-runner-empty-copy">등록된 예약 실행이 없습니다.</p> : schedules.slice().sort((left, right) => left.localTime.localeCompare(right.localTime)).map((schedule) => {
                const collection = collections.find((candidate) => candidate.id === schedule.collectionId);
                return <article key={schedule.id} className={!schedule.enabled ? "disabled" : undefined}><header><div><span className="api-schedule-time">매일 {schedule.localTime}</span><strong>{schedule.name}</strong></div><label className="api-runner-switch"><input type="checkbox" checked={schedule.enabled} aria-label={`${schedule.name} 예약 활성화`} onChange={(event) => setSchedules((currentSchedules) => currentSchedules.map((currentSchedule) => currentSchedule.id === schedule.id ? { ...currentSchedule, enabled: event.target.checked, nextRunAt: event.target.checked ? calculateNextDailyRun(currentSchedule.localTime) : currentSchedule.nextRunAt, updatedAt: new Date().toISOString() } : currentSchedule))} /><span>{schedule.enabled ? "ON" : "OFF"}</span></label></header><p>{collection?.name ?? "삭제된 Collection"} · {schedule.selectedRequestIds.length}개 요청 × {schedule.iterationCount}회</p><dl><div><dt>다음 실행</dt><dd>{schedule.enabled ? formatDateTime(schedule.nextRunAt) : "일시 중지"}</dd></div><div><dt>최근 실행</dt><dd className={schedule.lastRunSuccessful === false ? "failure" : schedule.lastRunSuccessful ? "success" : undefined}>{formatDateTime(schedule.lastRunAt)}</dd></div></dl><footer><button type="button" className="ghost-button" onClick={() => editSchedule(schedule)}>수정</button><button type="button" className="ghost-button danger-text" onClick={() => deleteSchedule(schedule.id)}>삭제</button></footer></article>;
              })}
            </div>
          </section> : null}

          {activeView === "HISTORY" ? <section className="api-runner-view">
            <div className="api-runner-section-heading"><div><h3>Run history</h3><p>최근 {API_COLLECTION_RUN_HISTORY_LIMIT}회 실행 결과를 브라우저에 보관합니다.</p></div>{runHistory.length > 0 ? <button type="button" className="ghost-button danger-text" onClick={() => { const deletedHistory = runHistory; setRunHistory([]); toast.success("실행 이력을 삭제했습니다.", { action: { label: "실행 취소", onClick: () => setRunHistory(deletedHistory) } }); }}>이력 비우기</button> : null}</div>
            {runHistory.length === 0 ? <p className="api-runner-empty-copy">아직 Collection 실행 이력이 없습니다.</p> : <div className="api-runner-history-list">{runHistory.map((run) => {
              const successCount = run.results.filter((result) => result.successful).length;
              return <details key={run.id}><summary><span className={`api-run-status ${run.status.toLowerCase()}`}>{run.status === "CANCELLED" ? "취소" : successCount === run.results.length ? "성공" : "확인"}</span><div><strong>{run.collectionName}</strong><small>{run.trigger === "SCHEDULED" ? "예약 실행" : "즉시 실행"} · {formatDateTime(run.startedAt)}</small></div><b>{successCount}/{run.results.length}</b></summary><div className="api-runner-history-results">{run.results.map((result) => <div key={result.id}><span className={`method-${result.method.toLowerCase()}`}>{result.method}</span><strong>{result.requestName}</strong><small>{result.iteration}회차</small><b className={result.successful ? "success" : "failure"}>{result.responseStatus ?? "ERR"}</b><time>{result.responseTimeMilliseconds}ms</time>{result.errorMessage ? <p>{result.errorMessage}</p> : null}</div>)}</div></details>;
            })}</div>}
          </section> : null}
        </div>
      )}
    </ModalDialog>
  );
};
