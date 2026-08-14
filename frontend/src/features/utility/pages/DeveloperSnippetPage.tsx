import { useMemo, useState } from "react";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { DocumentPagination } from "@/features/document/components/DocumentPagination";
import { SnippetEditor } from "@/features/utility/components/SnippetEditor";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { useBulkDeleteSnippetsMutation, useBulkRestoreSnippetsMutation, useCreateSnippetMutation, useDeleteSnippetMutation, useRestoreSnippetMutation, useSnippetsQuery, useUpdateSnippetMutation } from "@/features/utility/hooks/useSnippetQueries";
import type { Snippet, SnippetSaveRequest, SnippetSearchCondition } from "@/features/utility/types/snippetTypes";
import { copyText } from "@/features/utility/utils/browserFileUtils";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

type PendingAction = { type: "DELETE" | "RESTORE"; snippetIds: number[]; title: string };

export const DeveloperSnippetPage = () => {
  const sessionQuery = useAuthSessionQuery();
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [language, setLanguage] = useState("ALL");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "TRASH">("ACTIVE");
  const [sort, setSort] = useState<SnippetSearchCondition["sort"]>("LATEST");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | "NEW">();
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [helpOpen, setHelpOpen] = useState(false);
  const condition = useMemo<SnippetSearchCondition>(() => ({ pageNumber, pageSize, keyword, language, favoriteOnly, status, sort }), [favoriteOnly, keyword, language, pageNumber, pageSize, sort, status]);
  const snippetsQuery = useSnippetsQuery(condition, Boolean(sessionQuery.data?.authenticated));
  const createMutation = useCreateSnippetMutation();
  const updateMutation = useUpdateSnippetMutation();
  const deleteMutation = useDeleteSnippetMutation();
  const restoreMutation = useRestoreSnippetMutation();
  const bulkDeleteMutation = useBulkDeleteSnippetsMutation();
  const bulkRestoreMutation = useBulkRestoreSnippetsMutation();
  const snippets = snippetsQuery.data?.content ?? [];
  const allCurrentPageSelected = snippets.length > 0 && snippets.every((snippet) => selectedIds.includes(snippet.snippetId));
  const languages = ["JavaScript", "TypeScript", "React", "Java", "SQL", "HTML", "CSS", "Shell", "JSON", "YAML", "기타"];
  const resetListSelection = (): void => { setPageNumber(0); setSelectedIds([]); };

  const handleError = (error: unknown): void => applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
  const saveSnippet = async (request: SnippetSaveRequest): Promise<void> => {
    try {
      if (editingSnippet === "NEW") await createMutation.mutateAsync(request);
      else if (editingSnippet) await updateMutation.mutateAsync({ snippetId: editingSnippet.snippetId, request });
      setEditingSnippet(undefined); setPageNumber(0); applicationNotification.success(editingSnippet === "NEW" ? "코드 조각을 등록했습니다." : "코드 조각을 수정했습니다.");
    } catch (error) { handleError(error); }
  };
  const toggleFavorite = async (snippet: Snippet): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ snippetId: snippet.snippetId, request: { title: snippet.title, description: snippet.description, language: snippet.language, code: snippet.code, tags: snippet.tags, favorite: !snippet.favorite } });
    } catch (error) { handleError(error); }
  };
  const executeAction = async (): Promise<void> => {
    if (!pendingAction) return;
    try {
      if (pendingAction.type === "DELETE") {
        if (pendingAction.snippetIds.length === 1) await deleteMutation.mutateAsync(pendingAction.snippetIds[0] as number);
        else await bulkDeleteMutation.mutateAsync(pendingAction.snippetIds);
      } else if (pendingAction.snippetIds.length === 1) await restoreMutation.mutateAsync(pendingAction.snippetIds[0] as number);
      else await bulkRestoreMutation.mutateAsync(pendingAction.snippetIds);
      applicationNotification.success(pendingAction.type === "DELETE" ? "선택한 코드 조각을 휴지통으로 이동했습니다." : "선택한 코드 조각을 복구했습니다.");
      setSelectedIds([]); setPendingAction(undefined);
      if (snippets.length === pendingAction.snippetIds.length && pageNumber > 0) setPageNumber((current) => current - 1);
    } catch (error) { handleError(error); }
  };
  const changeListMode = (nextStatus: "ACTIVE" | "TRASH"): void => { setStatus(nextStatus); setPageNumber(0); setSelectedIds([]); setEditingSnippet(undefined); };

  return (
    <section className="site-page utility-workbench-page">
      <UtilityPageTitle kicker="Developer Utility · Member CRUD" title="Developer Snippet" description="자주 쓰는 코드 조각을 로그인 회원별로 저장·검색·즐겨찾기하고 휴지통에서 복구합니다." onHelpOpen={() => setHelpOpen(true)} />
      {!sessionQuery.data?.authenticated ? <div className="snippet-login-state"><strong>로그인이 필요합니다.</strong><p>코드 조각은 회원별 개인 데이터이므로 로그인 후 사용할 수 있습니다. 상단의 로그인 또는 회원가입을 이용해 주세요.</p></div> : <>
        <div className="snippet-list-tabs" role="tablist" aria-label="코드 조각 목록"><button type="button" role="tab" aria-selected={status === "ACTIVE"} className={status === "ACTIVE" ? "active" : undefined} onClick={() => changeListMode("ACTIVE")}>내 코드 조각</button><button type="button" role="tab" aria-selected={status === "TRASH"} className={status === "TRASH" ? "active" : undefined} onClick={() => changeListMode("TRASH")}>휴지통</button></div>
        <div className="snippet-toolbar"><label>검색<input type="search" value={keyword} placeholder="제목·설명·코드·태그" onChange={(event) => { setKeyword(event.target.value); resetListSelection(); }} /></label><label>언어<select value={language} onChange={(event) => { setLanguage(event.target.value); resetListSelection(); }}><option value="ALL">전체 언어</option>{languages.map((item) => <option key={item}>{item}</option>)}</select></label><label>정렬<select value={sort} onChange={(event) => { setSort(event.target.value as SnippetSearchCondition["sort"]); resetListSelection(); }}><option value="LATEST">최근 수정순</option><option value="TITLE">제목순</option><option value="FAVORITE">즐겨찾기 우선</option></select></label><label>개수<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetListSelection(); }}><option value={10}>10개</option><option value={20}>20개</option><option value={50}>50개</option></select></label>{status === "ACTIVE" ? <label className="checkbox-label"><input type="checkbox" checked={favoriteOnly} onChange={(event) => { setFavoriteOnly(event.target.checked); resetListSelection(); }} />즐겨찾기만</label> : null}<button type="button" onClick={() => setEditingSnippet("NEW")}>+ 새 코드 조각</button></div>
        {editingSnippet ? <SnippetEditor snippet={editingSnippet === "NEW" ? undefined : editingSnippet} pending={createMutation.isPending || updateMutation.isPending} onCancel={() => setEditingSnippet(undefined)} onSave={(request) => void saveSnippet(request)} /> : null}
        <div className="snippet-selection-bar"><label className="checkbox-label"><input type="checkbox" checked={allCurrentPageSelected} disabled={snippets.length === 0} onChange={(event) => setSelectedIds(event.target.checked ? snippets.map((snippet) => snippet.snippetId) : [])} />현재 페이지 전체 선택</label><span>{selectedIds.length}개 선택</span>{selectedIds.length > 0 ? <button type="button" className="ghost-button" onClick={() => setPendingAction({ type: status === "ACTIVE" ? "DELETE" : "RESTORE", snippetIds: selectedIds, title: `${selectedIds.length}개 코드 조각` })}>{status === "ACTIVE" ? "선택 항목 휴지통 이동" : "선택 항목 복구"}</button> : null}</div>
        {snippetsQuery.isPending ? <div className="portfolio-state-panel">코드 조각을 불러오는 중입니다.</div> : null}{snippetsQuery.isError ? <div className="portfolio-state-panel error-state">코드 조각을 불러오지 못했습니다.</div> : null}{!snippetsQuery.isPending && snippets.length === 0 ? <div className="portfolio-state-panel">{status === "ACTIVE" ? "조건에 맞는 코드 조각이 없습니다." : "휴지통이 비어 있습니다."}</div> : null}
        <div className="snippet-card-grid">{snippets.map((snippet) => <article className={`snippet-card${snippet.favorite ? " favorite" : ""}`} key={snippet.snippetId}><header><label className="checkbox-label"><input type="checkbox" aria-label={`${snippet.title} 선택`} checked={selectedIds.includes(snippet.snippetId)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, snippet.snippetId] : current.filter((id) => id !== snippet.snippetId))} /></label><span>{snippet.language}</span>{status === "ACTIVE" ? <button type="button" className="snippet-star-button" aria-label={`${snippet.title} 즐겨찾기 ${snippet.favorite ? "해제" : "설정"}`} onClick={() => void toggleFavorite(snippet)}>{snippet.favorite ? "★" : "☆"}</button> : null}</header><h2>{snippet.title}</h2><p>{snippet.description || "설명이 없습니다."}</p><div className="snippet-tags">{snippet.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div><pre><code>{snippet.code}</code></pre><footer><time dateTime={snippet.updatedAt}>{new Date(snippet.updatedAt).toLocaleString("ko-KR")}</time><div><button type="button" className="ghost-button" onClick={() => void copyText(snippet.code).then(() => applicationNotification.success("코드를 복사했습니다."))}>복사</button>{status === "ACTIVE" ? <><button type="button" className="ghost-button" onClick={() => setEditingSnippet(snippet)}>수정</button><button type="button" className="ghost-button danger-button" onClick={() => setPendingAction({ type: "DELETE", snippetIds: [snippet.snippetId], title: snippet.title })}>삭제</button></> : <button type="button" className="ghost-button" onClick={() => setPendingAction({ type: "RESTORE", snippetIds: [snippet.snippetId], title: snippet.title })}>복구</button>}</div></footer></article>)}</div>
        {snippetsQuery.data ? <DocumentPagination ariaLabel="코드 조각 목록 페이지 이동" pageInformation={snippetsQuery.data.pageInformation} handlePageChange={(nextPage) => { setPageNumber(nextPage); setSelectedIds([]); }} /> : null}
      </>}
      <ConfirmDialog isOpen={Boolean(pendingAction)} title={pendingAction?.type === "DELETE" ? "휴지통으로 이동" : "코드 조각 복구"} description={`“${pendingAction?.title ?? ""}”을 ${pendingAction?.type === "DELETE" ? "휴지통으로 이동" : "내 코드 조각으로 복구"}할까요?`} confirmButtonLabel={pendingAction?.type === "DELETE" ? "이동" : "복구"} isConfirming={deleteMutation.isPending || restoreMutation.isPending || bulkDeleteMutation.isPending || bulkRestoreMutation.isPending} onConfirm={() => void executeAction()} onCancel={() => setPendingAction(undefined)} />
      <UtilityHelpDialog isOpen={helpOpen} title="Developer Snippet" description="회원 소유권이 있는 실제 서버 CRUD와 휴지통 흐름을 보여줍니다." onClose={() => setHelpOpen(false)}><article><h3>사용 방법</h3><ol><li>로그인 후 제목·언어·코드·태그를 저장합니다.</li><li>검색·언어·즐겨찾기·정렬과 서버 페이징으로 찾습니다.</li><li>단건 또는 현재 페이지 다중 선택으로 휴지통에 보냅니다.</li><li>휴지통 탭에서 다시 복구합니다.</li></ol></article><article><h3>보안과 데이터 격리</h3><p>프론트가 회원 번호를 보내지 않습니다. 백엔드가 HttpOnly 세션에서 회원을 찾고 모든 SELECT·UPDATE·DELETE에 member_id 조건을 적용합니다.</p></article><article><h3>학습 포인트</h3><p>TanStack Query 서버 상태, 검색 조건 queryKey, 소프트 삭제, 다중 작업, Controller → Service → DAO → MyBatis 흐름을 확인해 보세요.</p></article></UtilityHelpDialog>
    </section>
  );
};
