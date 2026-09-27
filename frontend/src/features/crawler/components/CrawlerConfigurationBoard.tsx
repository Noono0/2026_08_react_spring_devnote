import { useMemo, useRef, useState } from "react";
import {
  useCreateCrawlerConfiguration,
  useCrawlerConfigurations,
  useCrawlerRunHistories,
  useCrawlerRunHistoryMutation,
  useDeleteCrawlerConfiguration,
  useDeleteCrawlerRunHistory,
  useUpdateCrawlerConfiguration,
} from "@/features/crawler/hooks/useWebCrawler";
import type {
  CrawlerConfiguration,
  CrawlerRunRequest,
  CrawlerRunResponse,
  CrawlerSitePreset,
} from "@/features/crawler/types/webCrawlerTypes";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { markInvalidFields } from "@/shared/lib/formValidation";
import { RequiredMark } from "@/features/crawler/components/RequiredMark";

interface CrawlerConfigurationBoardProps {
  sitePreset: CrawlerSitePreset;
  editorOpen: boolean;
  selectedConfigurationId?: number;
  getCurrentRequest: () => CrawlerRunRequest | undefined;
  onLoad: (configuration: CrawlerConfiguration) => void;
  onSelect: (configurationId?: number) => void;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onShowHistoryResult: (result: CrawlerRunResponse) => void;
}

type PendingDelete =
  | { type: "CONFIGURATION"; id: number; title: string }
  | { type: "HISTORY"; id: number; title: string };

const statusLabel = (status: string | null): string => {
  if (status === "SUCCESS") return "성공";
  if (status === "FAILURE") return "실패";
  if (status === "RUNNING") return "실행 중";
  return "실행 전";
};

export const CrawlerConfigurationBoard = ({
  sitePreset,
  editorOpen,
  selectedConfigurationId,
  getCurrentRequest,
  onLoad,
  onSelect,
  onOpenEditor,
  onCloseEditor,
  onShowHistoryResult,
}: CrawlerConfigurationBoardProps) => {
  const configurationsQuery = useCrawlerConfigurations();
  const historiesQuery = useCrawlerRunHistories(selectedConfigurationId);
  const createMutation = useCreateCrawlerConfiguration();
  const updateMutation = useUpdateCrawlerConfiguration();
  const deleteMutation = useDeleteCrawlerConfiguration();
  const historyMutation = useCrawlerRunHistoryMutation();
  const deleteHistoryMutation = useDeleteCrawlerRunHistory(selectedConfigurationId);
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>();
  const filteredConfigurations = useMemo(() => {
    const configurations = configurationsQuery.data ?? [];
    const normalized = keyword.trim().toLocaleLowerCase("ko-KR");
    if (!normalized) return configurations;
    return configurations.filter((configuration) =>
      `${configuration.title} ${configuration.description} ${configuration.request.startUrl}`
        .toLocaleLowerCase("ko-KR").includes(normalized));
  }, [configurationsQuery.data, keyword]);

  const handleError = (error: unknown): void => applicationNotification.apiError(convertRequestErrorToProblemDetails(error));

  const loadConfiguration = (configuration: CrawlerConfiguration): void => {
    setTitle(configuration.title);
    setDescription(configuration.description);
    onSelect(configuration.configurationId);
    onLoad(configuration);
    onOpenEditor();
    applicationNotification.success("저장된 크롤링 설정을 불러왔습니다.");
  };

  const startNewConfiguration = (): void => {
    setTitle("");
    setDescription("");
    onSelect(undefined);
    onOpenEditor();
  };

  const saveConfiguration = async (): Promise<void> => {
    if (!title.trim()) {
      if (titleInputRef.current) markInvalidFields([titleInputRef.current]);
      applicationNotification.warning("* 설정 제목을 입력해 주세요.");
      return;
    }
    const request = getCurrentRequest();
    if (!request) {
      // 실행 설정 폼이 문제 있는 칸을 붉게 표시하고 그 칸으로 포커스를 옮긴다.
      applicationNotification.warning("붉게 표시된 입력칸을 확인해 주세요.");
      return;
    }
    try {
      const saved = selectedConfigurationId === undefined
        ? await createMutation.mutateAsync({ title: title.trim(), description: description.trim(), sitePreset, request })
        : await updateMutation.mutateAsync({
          configurationId: selectedConfigurationId,
          request: { title: title.trim(), description: description.trim(), sitePreset, request },
        });
      setTitle(saved.title);
      setDescription(saved.description);
      onSelect(saved.configurationId);
      onCloseEditor();
      applicationNotification.success(selectedConfigurationId === undefined ? "크롤링 설정을 등록했습니다." : "크롤링 설정을 수정했습니다.");
    } catch (error) {
      handleError(error);
    }
  };

  const showHistory = async (historyId: number): Promise<void> => {
    try {
      const history = await historyMutation.mutateAsync(historyId);
      if (!history.result) {
        applicationNotification.warning("실패한 실행에는 표시할 수집 결과가 없습니다.", history.failureMessage ?? undefined);
        return;
      }
      onShowHistoryResult(history.result);
      applicationNotification.success("저장된 실행 결과를 화면 아래에 표시했습니다.");
    } catch (error) {
      handleError(error);
    }
  };

  const executeDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.type === "CONFIGURATION") {
        await deleteMutation.mutateAsync(pendingDelete.id);
        if (selectedConfigurationId === pendingDelete.id) startNewConfiguration();
        applicationNotification.success("크롤링 설정과 연결된 실행 이력을 삭제했습니다.");
      } else {
        await deleteHistoryMutation.mutateAsync(pendingDelete.id);
        applicationNotification.success("실행 이력을 삭제했습니다.");
      }
      setPendingDelete(undefined);
    } catch (error) {
      handleError(error);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const deleting = deleteMutation.isPending || deleteHistoryMutation.isPending;

  return (
    <section className="crawler-board" aria-labelledby="crawler-board-title">
      <header className="crawler-board-header">
        <div><span className="page-kicker">Saved Crawler Board</span><h2 id="crawler-board-title">크롤링 설정 게시판</h2><p>URL·선택자·필드·키워드 조건을 저장해서 다시 사용하고, 실행 성공과 실패를 이력으로 확인합니다.</p></div>
        {editorOpen
          ? <button type="button" className="secondary-button" onClick={onCloseEditor}>목록으로</button>
          : <button type="button" onClick={startNewConfiguration}>+ 새 설정</button>}
      </header>

      {editorOpen ? <div className="crawler-board-editor">
        <label><span><RequiredMark /> 설정 제목</span><input ref={titleInputRef} required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 네이버 카페 LH 매물 검색" /></label>
        <label>설명<textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="이 설정의 용도와 검색 조건을 적어 두세요." /></label>
        <div><strong>{selectedConfigurationId === undefined ? "새 설정으로 저장" : `#${selectedConfigurationId} 설정 수정`}</strong><small>아이디와 비밀번호는 게시글 및 실행 이력에 저장하지 않습니다.</small><div className="crawler-board-editor-actions"><button type="button" className="secondary-button" onClick={onCloseEditor}>취소</button><button type="button" disabled={saving} onClick={() => void saveConfiguration()}>{saving ? "저장 중…" : selectedConfigurationId === undefined ? "현재 설정 등록" : "현재 설정 수정"}</button></div></div>
      </div> : null}

      {!editorOpen ? <div className="crawler-board-toolbar"><label>설정 검색<input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="제목·설명·URL" /></label><span>총 {filteredConfigurations.length}개</span></div> : null}
      {!editorOpen && configurationsQuery.isPending ? <div className="portfolio-state-panel">저장된 크롤링 설정을 불러오는 중입니다.</div> : null}
      {!editorOpen && configurationsQuery.isError ? <div className="portfolio-state-panel error-state">저장된 크롤링 설정을 불러오지 못했습니다.</div> : null}
      {!editorOpen && !configurationsQuery.isPending && filteredConfigurations.length === 0 ? <div className="portfolio-state-panel">저장된 크롤링 설정이 없습니다. `+ 새 설정`을 눌러 첫 설정을 등록해 보세요.</div> : null}
      {!editorOpen && filteredConfigurations.length > 0 ? <div className="crawler-board-table-wrap"><table><caption>저장된 크롤링 설정</caption><thead><tr><th scope="col">번호</th><th scope="col">제목과 대상</th><th scope="col">최근 실행</th><th scope="col">수정일</th><th scope="col">관리</th></tr></thead><tbody>{filteredConfigurations.map((configuration) => <tr className={configuration.configurationId === selectedConfigurationId ? "selected" : undefined} key={configuration.configurationId}><td>#{configuration.configurationId}</td><td><strong>{configuration.title}</strong><small>{configuration.description || "설명 없음"}</small><a href={configuration.request.startUrl} target="_blank" rel="noreferrer">{configuration.request.startUrl}</a></td><td><span className={`crawler-history-status ${configuration.lastRunStatus?.toLocaleLowerCase() ?? "idle"}`}>{statusLabel(configuration.lastRunStatus)}</span><small>{configuration.runCount}회 실행</small></td><td><time dateTime={configuration.updatedAt}>{new Date(configuration.updatedAt).toLocaleString("ko-KR")}</time></td><td><div className="crawler-board-actions"><button type="button" className="secondary-button" onClick={() => loadConfiguration(configuration)}>열기·수정</button><button type="button" className="danger-button" onClick={() => setPendingDelete({ type: "CONFIGURATION", id: configuration.configurationId, title: configuration.title })}>삭제</button></div></td></tr>)}</tbody></table></div> : null}

      {!editorOpen && selectedConfigurationId !== undefined ? <section className="crawler-history-panel"><header><div><h3>실행 이력</h3><p>선택한 설정으로 크롤링을 실행하면 성공 결과와 실패 원인이 자동으로 기록됩니다.</p></div><button type="button" className="secondary-button" onClick={() => void historiesQuery.refetch()} disabled={historiesQuery.isFetching}>새로고침</button></header>{historiesQuery.isPending ? <div className="portfolio-state-panel">실행 이력을 불러오는 중입니다.</div> : null}{!historiesQuery.isPending && (historiesQuery.data?.length ?? 0) === 0 ? <div className="portfolio-state-panel">아직 실행 이력이 없습니다.</div> : null}<div className="crawler-history-list">{historiesQuery.data?.map((history) => <article key={history.historyId}><div><span className={`crawler-history-status ${history.status.toLocaleLowerCase()}`}>{statusLabel(history.status)}</span><strong>#{history.historyId} · {history.itemCount}건</strong><time dateTime={history.startedAt}>{new Date(history.startedAt).toLocaleString("ko-KR")}</time></div>{history.failureMessage ? <p><strong>{history.failureStage ?? "실패"}</strong> · {history.failureMessage}</p> : <p>{(history.durationMillis / 1000).toFixed(1)}초 소요</p>}<footer>{history.status === "SUCCESS" ? <button type="button" className="secondary-button" onClick={() => void showHistory(history.historyId)} disabled={historyMutation.isPending}>결과 보기</button> : null}<button type="button" className="danger-button" onClick={() => setPendingDelete({ type: "HISTORY", id: history.historyId, title: `실행 이력 #${history.historyId}` })}>삭제</button></footer></article>)}</div></section> : null}

      <ConfirmDialog isOpen={pendingDelete !== undefined} title={pendingDelete?.type === "CONFIGURATION" ? "크롤링 설정 삭제" : "실행 이력 삭제"} description={`“${pendingDelete?.title ?? ""}”을 삭제할까요?${pendingDelete?.type === "CONFIGURATION" ? " 연결된 실행 이력도 함께 삭제됩니다." : ""}`} confirmButtonLabel="삭제" isConfirming={deleting} onConfirm={() => void executeDelete()} onCancel={() => setPendingDelete(undefined)} />
    </section>
  );
};
