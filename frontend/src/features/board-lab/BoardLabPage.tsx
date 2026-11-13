import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RichTextEditor } from "@/features/rich-text-editor/components/RichTextEditor";
import { resolveEditorInitialContent } from "@/features/rich-text-editor/utils/editorInitialContent";
import { ThumbnailImageUploader } from "@/features/file/components/ThumbnailImageUploader";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { sanitizeRichTextHtml } from "@/shared/lib/sanitizeRichTextHtml";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import {
  boardApi, boardDescriptions, boardLabels, boardTypes, parseBoardType,
  categoryLabels, communityCategories, isCommunityType, parseCategory,
  type BoardPost, type BoardType, type EditorContentValue,
} from "./boardApi";
import { isCalendarDate, normalizePopupPath, seoulDate, todayDate } from "./calendarDates";
import { CommunityBoardList } from "./CommunityBoardList";
import "./boardLab.css";

const emptyContent: EditorContentValue = {
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p></p>", contentText: "",
};
const boardPath = (type: BoardType) => isCommunityType(type) ? "/react/boards/community" : `/react/boards/${type.toLowerCase()}`;
const postPath = (type: BoardType, id: number) => `/react/boards/${type.toLowerCase()}/${id}`;
const viewerKey = (memberId: number | undefined, administrator: boolean | undefined) => [memberId ?? "guest", Boolean(administrator)] as const;
const validId = (value: string | undefined): number | undefined => {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
};
const imageUrl = (fileId: number) => `/api/v1/files/${fileId}/content`;
const showError = (error: unknown): void => applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
const queryRoot = ["board-lab"] as const;
const GridBoardList = lazy(() => import("./GridBoardList").then((module) => ({ default: module.GridBoardList })));
const CalendarBoard = lazy(() => import("./CalendarBoard").then((module) => ({ default: module.CalendarBoard })));
const withLoading = (content: ReactNode) => <Suspense fallback={<div className="state-panel" role="status">화면을 불러오는 중입니다.</div>}>{content}</Suspense>;

function BoardTabs({ selected }: { selected: BoardType }) {
  const tabs: BoardType[] = ["GENERAL", "GALLERY", "GRID", "CALENDAR", "POPUP"];
  return <nav className="board-lab-tabs" aria-label="게시판 종류">
    {tabs.map((type) => <Link key={type} to={boardPath(type)} aria-current={(isCommunityType(selected) ? "GENERAL" : selected) === type ? "page" : undefined}>
      {type === "GENERAL" ? "통합 게시판" : boardLabels[type]}
    </Link>)}
  </nav>;
}

function BoardGuide() {
  return <details className="board-lab-guide"><summary>게시판별 기능 차이</summary>
    <p>통합 게시판에서 일반·공지·Q&A 글을 함께 조회하고 분류로 걸러 봅니다. 갤러리·그리드·달력·팝업은 별도 용도로 관리합니다.</p>
    <dl>{boardTypes.map((type) => <div key={type}><dt>{boardLabels[type]}</dt><dd>{boardDescriptions[type]}</dd></div>)}</dl>
  </details>;
}

function BoardList({ type }: { type: "GALLERY" | "GRID" | "POPUP" }) {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const rawPage = Number(searchParameters.get("page") ?? "0");
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 100000 ? rawPage : 0;
  const keyword = searchParameters.get("keyword")?.slice(0, 100) ?? "";
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  useEffect(() => setDraftKeyword(keyword), [keyword, type]);
  const session = useAuthSessionQuery();
  const list = useQuery({
    queryKey: [...queryRoot, "list", type, keyword, page, ...viewerKey(session.data?.memberId, session.data?.administrator)],
    queryFn: ({ signal }) => boardApi.list(type, keyword, page, signal),
    enabled: type !== "POPUP" || Boolean(session.data?.administrator),
  });
  const canCreate = session.data?.authenticated && (type !== "POPUP" || session.data.administrator);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchParameters(draftKeyword.trim() ? { keyword: draftKeyword.trim().slice(0, 100) } : {});
  };
  const goPage = (nextPage: number) => setSearchParameters({ ...(keyword ? { keyword } : {}), page: String(nextPage) });
  if (type === "POPUP" && session.isPending) return <p role="status">관리자 권한을 확인하는 중입니다.</p>;
  if (type === "POPUP" && !session.data?.administrator) return <p role="alert" className="state-panel error-state">팝업 관리는 관리자만 이용할 수 있습니다.</p>;

  return <section className="board-lab-panel">
    <div className="board-lab-heading">
      <div><h2>{boardLabels[type]}</h2><p>{boardDescriptions[type]}</p></div>
      {canCreate ? <Link className="primary-link" to={`${boardPath(type)}/new`}>글쓰기</Link> : null}
    </div>
    {!session.data?.authenticated && !session.isLoading ? <p className="board-lab-hint">글을 작성하려면 로그인해 주세요.</p> : null}
    <form className="board-lab-search" onSubmit={submitSearch} role="search">
      <label htmlFor="board-keyword">제목·내용 검색</label>
      <input id="board-keyword" value={draftKeyword} maxLength={100} onChange={(event) => setDraftKeyword(event.target.value)} placeholder="검색어" />
      <button type="submit">검색</button>
    </form>
    {list.isPending ? <div className="state-panel" role="status">게시글을 불러오는 중입니다.</div> : null}
    {list.isError ? <div className="state-panel error-state" role="alert"><p>게시글을 불러오지 못했습니다.</p><button type="button" onClick={() => void list.refetch()}>다시 시도</button></div> : null}
    {list.data && list.data.content.length === 0 ? <div className="state-panel">검색 결과가 없습니다.</div> : null}
    {list.data && list.data.content.length > 0 ? <>
      <p className="board-lab-count">전체 {list.data.pageInformation.totalElements}건</p>
      {type === "GRID" ? <><p className="board-lab-hint">열 정렬·필터는 현재 페이지의 최대 50건에 적용됩니다. 전체 검색은 위 검색창을 이용하세요.</p>
        {withLoading(<GridBoardList posts={list.data.content} />)}</> : <ul className={type === "GALLERY" ? "board-lab-gallery" : "board-lab-list"}>
        {list.data.content.map((post) => <li key={post.postId}>
          <Link to={postPath(type, post.postId)}>
            {type === "GALLERY" && post.imageFileId ? <img src={imageUrl(post.imageFileId)} alt="" loading="lazy" /> : null}
            <div className="board-lab-item-content">
              <strong>{post.pinned ? "[고정] " : ""}{post.title}</strong>
              {type === "POPUP" && post.popup ? <><span className="board-lab-status">{!post.popup.enabled ? "노출 중지" : post.eventDate && post.eventDate > seoulDate() ? "예약" : post.eventEndDate && post.eventEndDate < seoulDate() ? "기간 종료" : "노출 중"}</span>
                <small>메뉴 {post.popup.targetPath}{post.popup.includeChildren ? " · 하위 경로 포함" : " · 해당 메뉴만"} · {post.eventDate} ~ {post.eventEndDate}</small></> : null}
              <p>{post.contentPreview}</p>
              <small>{post.authorName} · {new Date(post.createdAt).toLocaleDateString("ko-KR")} · 조회 {post.viewCount}</small>
            </div>
          </Link>
        </li>)}
      </ul>}
      <div className="board-lab-pagination">
        <button type="button" onClick={() => goPage(page - 1)} disabled={list.data.pageInformation.firstPage}>이전</button>
        <span>{page + 1} / {list.data.pageInformation.totalPages}</span>
        <button type="button" onClick={() => goPage(page + 1)} disabled={list.data.pageInformation.lastPage}>다음</button>
      </div>
    </> : null}
  </section>;
}

function PostEditor({ type: initialType, existing }: { type: BoardType; existing?: BoardPost }) {
  const [type, setType] = useState(initialType);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuthSessionQuery();
  const [searchParameters] = useSearchParams();
  const titleReference = useRef<HTMLInputElement>(null);
  const editorReference = useRef<HTMLDivElement>(null);
  const imageReference = useRef<HTMLDivElement>(null);
  const dateReference = useRef<HTMLInputElement>(null);
  const endDateReference = useRef<HTMLInputElement>(null);
  const targetReference = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState<EditorContentValue>(existing ? {
    contentJson: existing.contentJson, contentHtml: existing.contentHtml, contentText: existing.contentText,
  } : emptyContent);
  const [imageFileId, setImageFileId] = useState<number | undefined>(existing?.imageFileId ?? undefined);
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const suggestedDate = searchParameters.get("date") ?? "";
  const initialDate = isCalendarDate(suggestedDate) ? suggestedDate : type === "POPUP" ? seoulDate() : todayDate();
  const [eventDate, setEventDate] = useState(existing?.eventDate ?? initialDate);
  const [eventEndDate, setEventEndDate] = useState(existing?.eventEndDate ?? existing?.eventDate ?? initialDate);
  const [targetPath, setTargetPath] = useState(existing?.popup?.targetPath ?? "/react");
  const [includeChildren, setIncludeChildren] = useState(existing?.popup?.includeChildren ?? false);
  const [popupEnabled, setPopupEnabled] = useState(existing?.popup?.enabled ?? true);
  const [validationError, setValidationError] = useState("");
  const save = useMutation({
    mutationFn: (submittedType: BoardType) => {
      const input = { ...content, title: title.trim(), imageFileId: imageFileId ?? null, pinned,
        eventDate: submittedType === "CALENDAR" || submittedType === "POPUP" ? eventDate : null,
        eventEndDate: submittedType === "CALENDAR" || submittedType === "POPUP" ? eventEndDate : null,
        popup: submittedType === "POPUP" ? { targetPath: normalizePopupPath(targetPath) ?? targetPath, includeChildren, enabled: popupEnabled } : null,
        ...(existing ? { versionNumber: existing.versionNumber } : {}) };
      return existing ? boardApi.update(submittedType, existing.postId, input) : boardApi.create(submittedType, input);
    },
    onSuccess: (saved, submittedType) => {
      void queryClient.invalidateQueries({ queryKey: queryRoot });
      applicationNotification.success(existing ? "게시글을 수정했습니다." : "게시글을 등록했습니다.");
      navigate(postPath(submittedType, saved.postId));
    },
    onError: showError,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (save.isPending) return;
    if (!title.trim()) { setValidationError("제목을 입력해 주세요."); titleReference.current?.focus(); return; }
    if (type === "CALENDAR" || type === "POPUP") {
      if (!isCalendarDate(eventDate)) { setValidationError("시작일을 1900~2100년의 올바른 날짜로 선택해 주세요."); dateReference.current?.focus(); return; }
      if (!isCalendarDate(eventEndDate)) { setValidationError("종료일을 1900~2100년의 올바른 날짜로 선택해 주세요."); endDateReference.current?.focus(); return; }
      if (eventEndDate < eventDate) { setValidationError("종료일은 시작일과 같거나 이후여야 합니다."); endDateReference.current?.focus(); return; }
    }
    if (type === "POPUP" && !normalizePopupPath(targetPath)) { setValidationError("메뉴 URL은 /react/boards처럼 사이트 내부 경로로 입력해 주세요."); targetReference.current?.focus(); return; }
    if (!content.contentText.trim()) { setValidationError("본문을 입력해 주세요."); editorReference.current?.querySelector<HTMLElement>("[contenteditable=true]")?.focus(); return; }
    if (type === "GALLERY" && !imageFileId) { setValidationError("대표 이미지를 올려 주세요."); imageReference.current?.querySelector<HTMLElement>("[tabindex]")?.focus(); return; }
    setValidationError("");
    save.mutate(type);
  };
  if (session.isPending) return <div className="state-panel" role="status">로그인 상태를 확인하는 중입니다.</div>;
  if (!session.data?.authenticated) return <div className="state-panel error-state" role="alert">글쓰기는 로그인 후 이용할 수 있습니다.</div>;
  if (type === "NOTICE" && !session.data.administrator) return <div className="state-panel error-state" role="alert">공지 작성은 관리자만 할 수 있습니다.</div>;
  if (type === "POPUP" && !session.data.administrator) return <div className="state-panel error-state" role="alert">팝업 관리는 관리자만 이용할 수 있습니다.</div>;
  return <form className="board-lab-panel board-lab-editor" onSubmit={submit} noValidate>
    <h2>{existing ? "게시글 수정" : type === "QNA" ? "새 질문" : type === "NOTICE" ? "새 공지" : type === "POPUP" ? "새 팝업" : "새 게시글"}</h2>
    {isCommunityType(type) ? <><label htmlFor="board-category">게시글 분류 *</label>
      <select id="board-category" value={type} disabled={Boolean(existing) || save.isPending} onChange={(event) => {
        const next = parseCategory(event.target.value);
        if (next) { setType(next); if (next !== "NOTICE") setPinned(false); }
      }}>{communityCategories.map((category) => <option key={category} value={category} disabled={category === "NOTICE" && !session.data.administrator}>{categoryLabels[category]}</option>)}</select>
      <p className="board-lab-hint">{boardDescriptions[type]}{existing ? " 분류는 수정 중에 변경할 수 없습니다." : ""}</p>
    </> : null}
    <label htmlFor="board-title">제목 *</label>
    <input ref={titleReference} id="board-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
    {type === "POPUP" ? <fieldset className="board-lab-popup-settings"><legend>팝업 표시 설정</legend>
      <label htmlFor="board-popup-path">표시할 메뉴 URL *</label>
      <input id="board-popup-path" ref={targetReference} value={targetPath} maxLength={300} placeholder="/react/boards" onChange={(event) => setTargetPath(event.target.value)} />
      <p className="board-lab-hint">도메인·검색 조건 없이 /로 시작하는 메뉴 경로를 입력하세요. /는 홈 화면입니다. 팝업 본문은 방문자에게 공개되는 안내입니다.</p>
      <label className="board-lab-checkbox"><input type="checkbox" checked={includeChildren} onChange={(event) => setIncludeChildren(event.target.checked)} /> 하위 경로에서도 표시</label>
      <label className="board-lab-checkbox"><input type="checkbox" checked={popupEnabled} onChange={(event) => setPopupEnabled(event.target.checked)} /> 팝업 노출 사용</label>
    </fieldset> : null}
    {type === "CALENDAR" || type === "POPUP" ? <fieldset className="board-lab-period"><legend>{type === "POPUP" ? "팝업 노출 기간 *" : "게시 기간 *"}</legend>
      <div><label htmlFor="board-event-date">시작일 (From) *</label>
        <input ref={dateReference} id="board-event-date" type="date" min="1900-01-01" max="2100-12-31" required value={eventDate} onChange={(event) => {
          const nextDate = event.target.value;
          setEventDate(nextDate);
          if (eventEndDate === eventDate) setEventEndDate(nextDate);
        }} /></div>
      <span aria-hidden="true">~</span>
      <div><label htmlFor="board-event-end-date">종료일 (To) *</label>
        <input ref={endDateReference} id="board-event-end-date" type="date" min={eventDate || "1900-01-01"} max="2100-12-31" required value={eventEndDate} onChange={(event) => setEventEndDate(event.target.value)} /></div>
      <p className="board-lab-hint">기본 기간은 당일이며, 시작일과 종료일을 모두 포함합니다.{type === "POPUP" ? " 노출 기간은 한국 시간 기준입니다." : ""}</p>
    </fieldset> : null}
    {type === "NOTICE" ? <label className="board-lab-checkbox"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> 목록 상단에 고정</label> : null}
    {type === "GALLERY" ? <div ref={imageReference}><ThumbnailImageUploader thumbnailImageUrl={imageFileId ? imageUrl(imageFileId) : undefined}
      handleThumbnailChange={(id) => setImageFileId(id)} title="갤러리 대표 이미지" description="갤러리 카드에 표시할 이미지를 올려 주세요." /></div> : null}
    <p className="board-lab-label">{type === "QNA" ? "질문 내용 *" : "본문 *"}</p>
    <div ref={editorReference}><RichTextEditor editorLabel="게시글 본문" initialContent={resolveEditorInitialContent(existing?.contentJson, existing?.contentHtml)}
      handleContentChange={setContent}
      handleImageUploaded={(id) => { if (type === "GALLERY" && !imageFileId) setImageFileId(id); }} /></div>
    {validationError ? <p className="board-lab-error" role="alert">{validationError}</p> : null}
    <div className="board-lab-actions"><Link className="secondary-link" to={existing ? postPath(type, existing.postId) : boardPath(type)}>취소</Link>
      <button type="submit" disabled={save.isPending}>{save.isPending ? "저장 중..." : "저장"}</button></div>
  </form>;
}

function AnswerEditor({ postId, onSaved }: { postId: number; onSaved: () => void }) {
  const [content, setContent] = useState<EditorContentValue>(emptyContent);
  const [error, setError] = useState("");
  const save = useMutation({ mutationFn: () => boardApi.answer(postId, content), onSuccess: () => {
    applicationNotification.success("답변을 등록했습니다."); onSaved();
  }, onError: showError });
  return <section className="board-lab-answer-editor"><h3>관리자 답변</h3>
    <RichTextEditor editorLabel="Q&A 답변" handleContentChange={setContent} />
    {error ? <p role="alert" className="board-lab-error">{error}</p> : null}
    <button type="button" disabled={save.isPending} onClick={() => {
      if (!content.contentText.trim()) { setError("답변을 입력해 주세요."); return; }
      setError(""); save.mutate();
    }}>{save.isPending ? "등록 중..." : "답변 등록"}</button>
  </section>;
}

function BoardDetail({ type, postId }: { type: BoardType; postId: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAnswerOpen, setConfirmAnswerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const session = useAuthSessionQuery();
  const post = useQuery({ queryKey: [...queryRoot, "detail", type, postId, ...viewerKey(session.data?.memberId, session.data?.administrator)], queryFn: ({ signal }) => boardApi.detail(type, postId, signal), staleTime: 30_000,
    enabled: !session.isPending && (type !== "POPUP" || Boolean(session.data?.administrator)) });
  const remove = useMutation({ mutationFn: () => boardApi.delete(type, postId), onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryRoot });
    applicationNotification.success("게시글을 삭제했습니다."); navigate(boardPath(type));
  }, onError: (error) => { setConfirmOpen(false); showError(error); } });
  const removeAnswer = useMutation({ mutationFn: () => boardApi.deleteAnswer(postId), onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryRoot });
    applicationNotification.success("답변을 삭제했습니다.");
    setConfirmAnswerOpen(false);
  }, onError: (error) => { setConfirmAnswerOpen(false); showError(error); } });
  if (type === "POPUP" && session.isPending) return <p role="status">관리자 권한을 확인하는 중입니다.</p>;
  if (type === "POPUP" && !session.data?.administrator) return <p role="alert" className="state-panel error-state">팝업 관리는 관리자만 이용할 수 있습니다.</p>;
  if (post.isPending) return <div className="state-panel" role="status">게시글을 불러오는 중입니다.</div>;
  if (post.isError) return <div className="state-panel error-state" role="alert">게시글을 불러오지 못했습니다. <button type="button" onClick={() => void post.refetch()}>다시 시도</button></div>;
  const item = post.data;
  return <article className="board-lab-panel">
    <div className="board-lab-heading"><div><h2>{item.title}</h2><p>{item.authorName} · {new Date(item.createdAt).toLocaleString("ko-KR")} · 조회 {item.viewCount}</p></div>
      <div className="board-lab-actions"><Link className="secondary-link" to={boardPath(type)}>목록</Link>
        {item.canEdit ? <Link className="secondary-link" to={`${postPath(type, postId)}/edit`}>수정</Link> : null}
        {item.canDelete ? <button type="button" className="danger-button" onClick={() => setConfirmOpen(true)}>삭제</button> : null}</div>
    </div>
    {type === "QNA" ? <p className="board-lab-status">{item.answered ? "답변 완료" : "답변 대기"}</p> : null}
    {type === "CALENDAR" && item.eventDate ? <p className="board-lab-status">기간 {item.eventDate} ~ {item.eventEndDate ?? item.eventDate}</p> : null}
    {type === "POPUP" && item.popup ? <p className="board-lab-hint">메뉴 {item.popup.targetPath} · {item.popup.includeChildren ? "하위 경로 포함" : "해당 메뉴만"} · {item.eventDate} ~ {item.eventEndDate} (한국 시간) · {item.popup.enabled ? "노출 사용" : "노출 중지"}</p> : null}
    {type === "POPUP" ? <><button type="button" onClick={() => setPreviewOpen(true)}>팝업 미리보기</button>
      <ModalDialog isOpen={previewOpen} title={item.title} onRequestClose={() => setPreviewOpen(false)} footer={<button type="button" onClick={() => setPreviewOpen(false)}>닫기</button>}>
        <div className="rendered-document-content" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(item.contentHtml) }} />
      </ModalDialog></> : null}
    {item.imageFileId ? <img className="board-lab-hero" src={imageUrl(item.imageFileId)} alt="게시글 대표 이미지" /> : null}
    <div className="rendered-document-content" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(item.contentHtml) }} />
    {item.answer ? <section className="board-lab-answer"><div className="board-lab-heading"><h3>관리자 답변 · {item.answer.authorName}</h3>
      {session.data?.administrator && type === "QNA" ? <button type="button" className="danger-button" disabled={removeAnswer.isPending} onClick={() => setConfirmAnswerOpen(true)}>답변 삭제</button> : null}</div>
      <div className="rendered-document-content" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(item.answer.contentHtml) }} /></section> : null}
    {item.canAnswer ? <AnswerEditor postId={postId} onSaved={() => { void queryClient.invalidateQueries({ queryKey: queryRoot }); }} /> : null}
    <ConfirmDialog isOpen={confirmOpen} title="게시글 삭제" description="이 게시글을 삭제하시겠습니까?" confirmButtonLabel="삭제하기"
      isConfirming={remove.isPending} onConfirm={() => remove.mutate()} onCancel={() => setConfirmOpen(false)} />
    <ConfirmDialog isOpen={confirmAnswerOpen} title="답변 삭제" description="이 질문의 답변을 삭제하시겠습니까?" confirmButtonLabel="삭제하기"
      isConfirming={removeAnswer.isPending} onConfirm={() => removeAnswer.mutate()} onCancel={() => setConfirmAnswerOpen(false)} />
  </article>;
}

function BoardEditorLoader({ type, postId }: { type: BoardType; postId: number }) {
  const session = useAuthSessionQuery();
  const permitted = session.data?.authenticated && (type !== "POPUP" || session.data.administrator);
  const post = useQuery({ queryKey: [...queryRoot, "detail", type, postId, ...viewerKey(session.data?.memberId, session.data?.administrator)],
    queryFn: ({ signal }) => boardApi.detail(type, postId, signal), staleTime: 30_000, enabled: !session.isPending && Boolean(permitted) });
  if (session.isPending) return <div className="state-panel" role="status">로그인 상태를 확인하는 중입니다.</div>;
  if (!session.data?.authenticated) return <div className="state-panel error-state" role="alert">글 수정은 로그인 후 이용할 수 있습니다.</div>;
  if (!permitted) return <div className="state-panel error-state" role="alert">팝업 관리는 관리자만 이용할 수 있습니다.</div>;
  if (post.isPending) return <div className="state-panel" role="status">게시글을 불러오는 중입니다.</div>;
  if (post.isError) return <div className="state-panel error-state" role="alert">게시글을 불러오지 못했습니다. <button type="button" onClick={() => void post.refetch()}>다시 시도</button></div>;
  if (!post.data.canEdit) return <div className="state-panel error-state" role="alert">수정할 권한이 없습니다.</div>;
  return <PostEditor key={`${post.data.postId}:${post.data.versionNumber}:${session.data.memberId}`} type={type} existing={post.data} />;
}

/** 목록·상세·작성·수정을 하나의 게시판 서비스로 연결하고, 본문에는 공통 Tiptap 에디터를 쓴다. */
export function BoardLabPage() {
  const { boardType, postId } = useParams();
  const { pathname } = useLocation();
  const [parameters] = useSearchParams();
  const community = !boardType || boardType.toLowerCase() === "community";
  const type = community ? parseCategory(parameters.get("category")) ?? "GENERAL" : parseBoardType(boardType);
  const id = validId(postId);
  if (!type || (postId && !id)) return <div className="state-panel error-state" role="alert">게시판 주소가 올바르지 않습니다. <Link to={boardPath("GENERAL")}>일반 게시판으로 이동</Link></div>;
  const editing = pathname.endsWith("/edit");
  const creating = pathname.endsWith("/new");
  if (community && creating && parameters.get("category") && !parseCategory(parameters.get("category"))) {
    return <p role="alert" className="state-panel error-state">게시글 분류가 올바르지 않습니다. <Link to="/react/boards/community/new">글쓰기</Link></p>;
  }
  return <div className="board-lab"><h1>게시판 실습</h1><p>분류에 따라 작성 기능이 달라지는 통합 게시판과 갤러리·그리드·달력·팝업을 관리합니다.</p>
    <BoardTabs selected={type} />
    <BoardGuide />
    {creating ? <PostEditor key={type} type={type} /> : id && editing ? <BoardEditorLoader type={type} postId={id} /> : id ? <BoardDetail type={type} postId={id} /> : community || isCommunityType(type) ? <CommunityBoardList legacyCategory={!community && isCommunityType(type) ? type : undefined} /> : type === "CALENDAR" ? withLoading(<CalendarBoard />) : <BoardList type={type} />}
  </div>;
}
