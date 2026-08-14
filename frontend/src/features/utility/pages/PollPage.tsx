import { useMemo, useState } from "react";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { DocumentPagination } from "@/features/document/components/DocumentPagination";
import { PollCard } from "@/features/utility/components/PollCard";
import { PollEditor } from "@/features/utility/components/PollEditor";
import { PollListView } from "@/features/utility/components/PollListView";
import {
  useCreatePollMutation,
  useDeletePollMutation,
  usePollsQuery,
  useUpdatePollMutation,
  useUpdatePollStatusMutation,
  useVotePollMutation,
} from "@/features/utility/hooks/usePollQueries";
import type { Poll, PollDefinitionRequest, PollStatus } from "@/features/utility/types/pollTypes";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

type PollFilter = "ALL" | PollStatus;
type PollViewMode = "LIST" | "DETAIL";

export const PollPage = () => {
  const sessionQuery = useAuthSessionQuery();
  const voteMutation = useVotePollMutation();
  const createMutation = useCreatePollMutation();
  const updateMutation = useUpdatePollMutation();
  const statusMutation = useUpdatePollStatusMutation();
  const deleteMutation = useDeletePollMutation();
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number[]>>({});
  const [editorMode, setEditorMode] = useState<"CLOSED" | "CREATE">("CLOSED");
  const [editingPoll, setEditingPoll] = useState<Poll>();
  const [deleteTargetPoll, setDeleteTargetPoll] = useState<Poll>();
  const [selectedDetailPollId, setSelectedDetailPollId] = useState<number>();
  const [filter, setFilter] = useState<PollFilter>("ALL");
  const [viewMode, setViewMode] = useState<PollViewMode>("LIST");
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const searchCondition = useMemo(
    () => ({ pageNumber, pageSize, status: filter }),
    [filter, pageNumber, pageSize],
  );
  const viewerScope = sessionQuery.data?.authenticated ? `member-${sessionQuery.data.memberId}` : "guest";
  const pollsQuery = usePollsQuery(searchCondition, viewerScope);
  const pagePolls = pollsQuery.data?.content ?? [];
  const detailPolls = selectedDetailPollId
    ? pagePolls.filter((poll) => poll.pollId === selectedDetailPollId)
    : pagePolls;

  const create = async (request: PollDefinitionRequest): Promise<void> => {
    try {
      await createMutation.mutateAsync(request);
      setEditorMode("CLOSED");
      setPageNumber(0);
      applicationNotification.success("새 투표를 만들었습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  const update = async (request: PollDefinitionRequest): Promise<void> => {
    if (!editingPoll) return;
    try {
      await updateMutation.mutateAsync({ pollId: editingPoll.pollId, request });
      setEditingPoll(undefined);
      applicationNotification.success("투표 설정을 수정했습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  const changeSelection = (poll: Poll, optionId: number, checked: boolean): void => {
    setSelectedOptions((currentSelections) => {
      const currentOptionIds = currentSelections[poll.pollId] ?? [];
      if (!poll.allowMultiple) return { ...currentSelections, [poll.pollId]: checked ? [optionId] : [] };
      const nextOptionIds = checked
        ? [...currentOptionIds, optionId]
        : currentOptionIds.filter((currentOptionId) => currentOptionId !== optionId);
      if (nextOptionIds.length > poll.maxSelections) {
        applicationNotification.warning(`최대 ${poll.maxSelections}개까지 선택할 수 있습니다.`);
        return currentSelections;
      }
      return { ...currentSelections, [poll.pollId]: nextOptionIds };
    });
  };

  const vote = async (poll: Poll): Promise<void> => {
    const optionIds = selectedOptions[poll.pollId] ?? [];
    if (optionIds.length === 0) return;
    try {
      await voteMutation.mutateAsync({ pollId: poll.pollId, optionIds });
      setSelectedOptions((currentSelections) => ({ ...currentSelections, [poll.pollId]: [] }));
      applicationNotification.success("투표에 참여했습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  const changeStatus = async (poll: Poll, status: Exclude<PollStatus, "OPEN">): Promise<void> => {
    try {
      await statusMutation.mutateAsync({ pollId: poll.pollId, status });
      applicationNotification.success(status === "CLOSED" ? "투표를 종료했습니다." : "투표 결과를 공개했습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  const deleteSelectedPoll = async (): Promise<void> => {
    if (!deleteTargetPoll) return;
    try {
      await deleteMutation.mutateAsync(deleteTargetPoll.pollId);
      if (pagePolls.length === 1 && pageNumber > 0) setPageNumber(pageNumber - 1);
      setDeleteTargetPoll(undefined);
      setSelectedDetailPollId(undefined);
      applicationNotification.success("투표를 목록에서 삭제했습니다.");
    } catch (error) { applicationNotification.apiError(convertRequestErrorToProblemDetails(error)); }
  };

  const openDetail = (poll: Poll): void => {
    setSelectedDetailPollId(poll.pollId);
    setViewMode("DETAIL");
  };

  return (
    <section className="site-page poll-page">
      <div className="page-hero poll-page-hero">
        <div><span className="page-kicker">Topic Poll</span><h1>토픽 투표</h1><p>질문과 문항을 자유롭게 만들고, 단일·복수 선택과 결과 공개 시점을 직접 설정합니다.</p></div>
        {sessionQuery.data?.authenticated ? <button type="button" onClick={() => { setEditingPoll(undefined); setEditorMode("CREATE"); }}>+ 새 토픽 만들기</button> : <div className="poll-login-note"><strong>투표 생성은 로그인 후 가능</strong><span>참여는 비회원도 할 수 있습니다.</span></div>}
      </div>

      {editorMode === "CREATE" ? <PollEditor pending={createMutation.isPending} onCancel={() => setEditorMode("CLOSED")} onSubmit={create} /> : null}
      {editingPoll ? <PollEditor key={editingPoll.pollId} initialPoll={editingPoll} pending={updateMutation.isPending} onCancel={() => setEditingPoll(undefined)} onSubmit={update} /> : null}

      <div className="poll-view-tabs" role="tablist" aria-label="투표 보기 방식">
        <button type="button" role="tab" aria-selected={viewMode === "LIST"} className={viewMode === "LIST" ? "active" : undefined} onClick={() => { setViewMode("LIST"); setSelectedDetailPollId(undefined); }}>목록 보기</button>
        <button type="button" role="tab" aria-selected={viewMode === "DETAIL"} className={viewMode === "DETAIL" ? "active" : undefined} onClick={() => { setViewMode("DETAIL"); setSelectedDetailPollId(undefined); }}>상세 보기</button>
      </div>

      <div className="poll-list-toolbar">
        <div>
          <strong>조회된 토픽 {pollsQuery.data?.pageInformation.totalElements ?? 0}개</strong>
          <span>서버에서 페이지 단위로 조회하며, 5초마다 상태와 공개 결과를 갱신합니다.</span>
        </div>
        <div className="poll-list-controls">
          <label>페이지 크기<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPageNumber(0); }}><option value={10}>10개</option><option value={20}>20개</option><option value={50}>50개</option></select></label>
          <div className="poll-filter-tabs" role="group" aria-label="투표 상태 필터">
            {(["ALL", "OPEN", "CLOSED", "RESULTS_PUBLISHED"] as const).map((status) => <button type="button" className={filter === status ? "active" : undefined} key={status} onClick={() => { setFilter(status); setPageNumber(0); }}>{status === "ALL" ? "전체" : status === "OPEN" ? "투표 중" : status === "CLOSED" ? "종료" : "결과 공개"}</button>)}
          </div>
        </div>
      </div>

      {pollsQuery.isPending ? <div className="portfolio-state-panel">투표를 불러오는 중입니다.</div> : null}
      {pollsQuery.isError ? <div className="portfolio-state-panel error-state">투표 목록을 불러오지 못했습니다.</div> : null}
      {!pollsQuery.isPending && pagePolls.length === 0 ? <div className="portfolio-state-panel">조건에 맞는 투표가 없습니다.</div> : null}

      {viewMode === "LIST" ? <PollListView polls={pagePolls} onDetailOpen={openDetail} onDelete={setDeleteTargetPoll} /> : null}
      {viewMode === "DETAIL" && selectedDetailPollId ? <div className="poll-selected-detail-heading"><strong>선택한 투표 상세</strong><button type="button" className="ghost-button" onClick={() => setSelectedDetailPollId(undefined)}>현재 페이지 전체 보기</button></div> : null}
      {viewMode === "DETAIL" ? <div className="poll-topic-list">
        {detailPolls.map((poll) => <PollCard
          key={poll.pollId}
          poll={poll}
          selectedOptionIds={selectedOptions[poll.pollId] ?? []}
          votePending={voteMutation.isPending && voteMutation.variables?.pollId === poll.pollId}
          statusPending={statusMutation.isPending && statusMutation.variables?.pollId === poll.pollId}
          onSelectionChange={changeSelection}
          onVote={(selectedPoll) => void vote(selectedPoll)}
          onEdit={(selectedPoll) => { setEditorMode("CLOSED"); setEditingPoll(selectedPoll); }}
          onDelete={setDeleteTargetPoll}
          onStatusChange={(selectedPoll, status) => void changeStatus(selectedPoll, status)}
        />)}
      </div> : null}

      {pollsQuery.data ? <DocumentPagination ariaLabel="투표 목록 페이지 이동" pageInformation={pollsQuery.data.pageInformation} handlePageChange={(nextPageNumber) => { setPageNumber(nextPageNumber); setSelectedDetailPollId(undefined); }} /> : null}

      <ConfirmDialog
        isOpen={Boolean(deleteTargetPoll)}
        title="투표 삭제"
        description={`“${deleteTargetPoll?.question ?? ""}” 투표를 목록에서 삭제할까요? 참여 기록은 감사와 복구를 위해 DB에 보존됩니다.`}
        confirmButtonLabel="삭제"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => void deleteSelectedPoll()}
        onCancel={() => setDeleteTargetPoll(undefined)}
      />
    </section>
  );
};
