import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { Pagination } from "@/shared/ui/Pagination";
import { todoApi, todoQueryRoot, todoStatuses, type Todo, type TodoInput, type TodoStatus, type TodoOwnerView } from "./todoApi";
import { parseReminderDrafts, reminderDrafts, reminderStatusLabels, type ReminderDraft } from "./todoReminderTimes";
import { TodoPushSettings } from "./TodoPushSettings";

const showError = (error: unknown) => applicationNotification.apiError(convertRequestErrorToProblemDetails(error));

function TodoEditor({ existing, onClose, onSaved }: { existing?: Todo; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [completed, setCompleted] = useState(existing?.completed ?? false);
  const [reminders, setReminders] = useState<ReminderDraft[]>(() => reminderDrafts(existing));
  const reminderSequence = useRef(0);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const save = useMutation({
    mutationFn: (input: TodoInput) => existing ? todoApi.update(existing.todoId, input) : todoApi.create(input),
    onSuccess: async () => { await onSaved(); applicationNotification.success(existing ? "할 일을 수정했습니다." : "할 일을 등록했습니다."); onClose(); },
    onError: showError,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (save.isPending) return;
    if (!title.trim()) { setError("할 일 제목을 입력해 주세요."); titleRef.current?.focus(); return; }
    let reminderTimes: string[];
    try { reminderTimes = parseReminderDrafts(reminders); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "알림 시간을 확인해 주세요."); return; }
    setError("");
    save.mutate({ title: title.trim(), content: content.trim(), completed, ...(existing ? { versionNumber: existing.versionNumber } : {}),
      ...(reminders.length || existing?.reminders.length ? { reminderTimes } : {}) });
  };
  return <ModalDialog isOpen title={existing ? "할 일 수정" : "새 할 일"} onRequestClose={() => { if (!save.isPending) onClose(); }}>
    <form className="board-lab-editor todo-editor" onSubmit={submit} noValidate aria-busy={save.isPending}>
      <label htmlFor="todo-title">할 일 제목 *</label>
      <input id="todo-title" ref={titleRef} value={title} maxLength={200} required disabled={save.isPending} onChange={(event) => setTitle(event.target.value)} />
      <label htmlFor="todo-content">메모</label>
      <textarea id="todo-content" rows={6} value={content} maxLength={10000} disabled={save.isPending} onChange={(event) => setContent(event.target.value)} />
      <fieldset className="todo-reminder-editor" disabled={save.isPending}>
        <legend>웹 푸시 알림 시간</legend>
        <p className="board-lab-hint">이 기기 시간대({Intl.DateTimeFormat().resolvedOptions().timeZone}) 기준 · 최대 20개 · 저장한 시간마다 한 번씩 발송합니다.</p>
        {reminders.map((reminder, index) => <div className="todo-reminder-row" key={reminder.id}>
          <label htmlFor={`todo-reminder-${reminder.id}`}>알림 시간 {index + 1}</label>
          <input id={`todo-reminder-${reminder.id}`} type="datetime-local" value={reminder.localTime}
            onChange={(event) => setReminders((current) => current.map((item) => item.id === reminder.id ? { ...item, localTime: event.target.value } : item))} />
          <button type="button" aria-label={`알림 시간 ${index + 1} 삭제`} onClick={() => setReminders((current) => current.filter((item) => item.id !== reminder.id))}>삭제</button>
        </div>)}
        <button type="button" disabled={reminders.length >= 20} onClick={() => {
          reminderSequence.current += 1;
          setReminders((current) => [...current, { id: `new-${reminderSequence.current}`, localTime: "" }]);
        }}>알림 시간 추가</button>
        <p className="board-lab-hint">알림을 받을 브라우저에서 웹 푸시를 켜 주세요. 완료 처리하면 대기 알림이 취소됩니다.</p>
      </fieldset>
      <label className="board-lab-checkbox"><input type="checkbox" checked={completed} disabled={save.isPending} onChange={(event) => setCompleted(event.target.checked)} /> 완료한 할 일</label>
      <p className="board-lab-hint">제목과 메모는 작성자 본인에게만 보입니다.</p>
      {error ? <p role="alert" className="board-lab-error">{error}</p> : null}
      <div className="board-lab-actions"><button type="button" disabled={save.isPending} onClick={onClose}>취소</button>
        <button type="submit" disabled={save.isPending}>{save.isPending ? "저장 중..." : "저장"}</button></div>
    </form>
  </ModalDialog>;
}

/** 계정이 바뀌면 key가 달라져 편집 중인 글과 필터 상태도 함께 정리한다. */
function MyTodos({ owner, onReconnect }: { owner: TodoOwnerView; onReconnect: () => void }) {
  const client = useQueryClient();
  const queryKey = [...todoQueryRoot, "items", owner.cacheKey];
  const [status, setStatus] = useState<TodoStatus>("ALL");
  const [draftKeyword, setDraftKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<Todo | "new" | null>(null);
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const list = useQuery({ queryKey: [...queryKey, status, keyword, page], gcTime: 0,
    queryFn: ({ signal }) => todoApi.list(status, keyword, page, signal) });
  const refresh = async () => { await client.invalidateQueries({ queryKey }); };
  const afterChange = async () => {
    // 마지막 페이지의 마지막 항목이 사라져도 빈 페이지에 머물지 않는다.
    setPage(0);
    await refresh();
  };
  const toggle = useMutation({ mutationFn: (todo: Todo) => todoApi.update(todo.todoId, {
    title: todo.title, content: todo.content, completed: !todo.completed, versionNumber: todo.versionNumber,
  }), onSuccess: afterChange, onError: (error) => { showError(error); void refresh(); } });
  const remove = useMutation({ mutationFn: (todo: Todo) => todoApi.delete(todo.todoId, todo.versionNumber),
    onSuccess: async () => { setDeleting(null); await afterChange(); applicationNotification.success("할 일을 삭제했습니다."); },
    onError: (error) => { showError(error); setDeleting(null); void refresh(); } });
  const busy = toggle.isPending || remove.isPending;
  const cookieRequired = list.isError && convertRequestErrorToProblemDetails(list.error).errorCode === "TODO_GUEST_COOKIE_REQUIRED";
  return <section className="board-lab-panel" aria-label="내 TODO 목록">
    <div className="board-lab-heading"><div><h2>TODO 리스트 게시판</h2><p>내가 등록한 할 일만 보고 관리합니다. 관리자에게도 공개되지 않습니다.</p></div>
      <button type="button" disabled={busy || list.isPending || list.isError} onClick={() => setEditor("new")}>할 일 추가</button></div>
    <p className="board-lab-hint">{owner.mode === "GUEST"
      ? "비회원 · 이 브라우저의 할 일입니다. 쿠키를 지우거나 다른 브라우저·기기를 사용하면 기존 할 일에 접근할 수 없습니다. 공용 브라우저에서는 같은 목록을 사용합니다."
      : "회원 · 내 계정의 할 일입니다. 로그아웃하면 이 브라우저의 비회원 목록으로 돌아갑니다."}</p>
    <TodoPushSettings owner={owner} />
    <form className="board-lab-search" role="search" onSubmit={(event) => {
      event.preventDefault(); setPage(0); setKeyword(draftKeyword.trim());
    }}>
      <label htmlFor="todo-status">할 일 상태</label>
      <select id="todo-status" value={status} onChange={(event) => {
        const selected = todoStatuses.find((value) => value === event.target.value);
        if (selected) { setStatus(selected); setPage(0); }
      }}><option value="ALL">전체</option><option value="ACTIVE">진행 중</option><option value="DONE">완료</option></select>
      <label htmlFor="todo-keyword">제목·메모 검색</label>
      <input id="todo-keyword" maxLength={100} value={draftKeyword} onChange={(event) => setDraftKeyword(event.target.value)} />
      <button type="submit">검색</button><button type="button" disabled={list.isFetching} onClick={() => void refresh()}>새로고침</button>
    </form>
    {list.isPending ? <p role="status">내 할 일을 불러오는 중입니다.</p> : null}
    {list.isError ? <div role="alert" className="state-panel error-state">{cookieRequired
      ? "비회원 TODO를 이용하려면 이 사이트의 쿠키를 허용해 주세요. 쿠키를 삭제했다면 새 비회원 목록으로 연결됩니다." : "할 일을 불러오지 못했습니다."}
      <button type="button" onClick={() => void list.refetch()}>다시 시도</button><button type="button" onClick={onReconnect}>브라우저 연결 다시 확인</button></div> : null}
    {list.data && !list.isError ? <><p className="board-lab-count">내 할 일 {list.data.pageInformation.totalElements}건 · 진행 중인 항목이 먼저 표시됩니다.</p>
      {list.data.content.length === 0 ? <p className="state-panel">표시할 할 일이 없습니다. 새 할 일을 추가하거나 검색 조건을 바꿔 보세요.</p> : <ul className="todo-board-list">
        {list.data.content.map((todo) => <li key={todo.todoId} data-completed={todo.completed}>
          <div className="todo-board-item"><label className="board-lab-checkbox"><input type="checkbox" checked={todo.completed} disabled={busy}
            aria-label={`${todo.title} 완료`} onChange={() => toggle.mutate(todo)} /><span className="todo-board-title">{todo.title}</span></label>
            <span className="board-lab-status">{todo.completed ? "완료" : "진행 중"}</span></div>
          {todo.content ? <details><summary>메모 보기</summary><p className="todo-board-memo">{todo.content}</p></details> : null}
          {todo.reminders.length ? <ul className="todo-reminder-summary" aria-label={`${todo.title} 알림 시간`}>
            {todo.reminders.map((reminder) => <li key={reminder.reminderId}><time dateTime={reminder.scheduledAt}>{new Date(reminder.scheduledAt).toLocaleString("ko-KR")}</time>
              <span>{reminderStatusLabels[reminder.status]}</span></li>)}
          </ul> : null}
          <div className="board-lab-actions"><small>등록 {new Date(todo.createdAt).toLocaleDateString("ko-KR")}</small><div className="todo-board-buttons">
            <button type="button" disabled={busy} aria-label={`${todo.title} 수정`} onClick={() => setEditor(todo)}>수정</button>
            <button type="button" disabled={busy} aria-label={`${todo.title} 삭제`} onClick={() => setDeleting(todo)}>삭제</button></div></div>
        </li>)}
      </ul>}
      <Pagination pageInformation={list.data.pageInformation} handlePageChange={setPage} ariaLabel="내 할 일 페이지 이동" />
    </> : null}
    {editor !== null ? <TodoEditor key={editor === "new" ? "new" : `${editor.todoId}:${editor.versionNumber}`}
      existing={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSaved={afterChange} /> : null}
    <ConfirmDialog isOpen={deleting !== null} title="할 일 삭제" description="이 할 일을 삭제하시겠습니까?" confirmButtonLabel="삭제하기"
      isConfirming={remove.isPending} onConfirm={() => { if (deleting && !remove.isPending) remove.mutate(deleting); }}
      onCancel={() => { if (!remove.isPending) setDeleting(null); }} />
  </section>;
}

export function TodoBoard() {
  const session = useAuthSessionQuery();
  const authKey = session.data?.authenticated ? `member:${session.data.memberId}` : "guest";
  const owner = useQuery({ queryKey: [...todoQueryRoot, "owner", authKey], queryFn: ({ signal }) => todoApi.owner(signal),
    enabled: !session.isPending, staleTime: 0, gcTime: 0, retry: false });
  if (session.isPending || owner.isPending) return <p role="status">내 할 일 연결을 확인하는 중입니다.</p>;
  if (owner.isError) return <div role="alert" className="state-panel error-state">내 할 일 연결을 확인하지 못했습니다. <button type="button" onClick={() => void owner.refetch()}>다시 시도</button></div>;
  return <MyTodos key={owner.data.cacheKey} owner={owner.data} onReconnect={() => { void owner.refetch(); }} />;
}
