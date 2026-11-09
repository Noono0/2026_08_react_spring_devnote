import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { RichTextEditor } from "@/features/rich-text-editor/components/RichTextEditor";
import { resolveEditorInitialContent } from "@/features/rich-text-editor/utils/editorInitialContent";
import { ThumbnailImageUploader } from "@/features/file/components/ThumbnailImageUploader";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { sanitizeRichTextHtml } from "@/shared/lib/sanitizeRichTextHtml";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import {
  boardApi, boardLabels, boardTypes, parseBoardType,
  type BoardPost, type BoardType, type EditorContentValue,
} from "./boardApi";
import "./boardLab.css";

const emptyContent: EditorContentValue = {
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p></p>", contentText: "",
};
const boardPath = (type: BoardType) => `/react/boards/${type.toLowerCase()}`;
const postPath = (type: BoardType, id: number) => `${boardPath(type)}/${id}`;
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
  return <nav className="board-lab-tabs" aria-label="게시판 종류">
    {boardTypes.map((type) => <Link key={type} to={boardPath(type)} aria-current={selected === type ? "page" : undefined}>
      {boardLabels[type]}
    </Link>)}
  </nav>;
}

function BoardList({ type }: { type: BoardType }) {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const rawPage = Number(searchParameters.get("page") ?? "0");
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 100000 ? rawPage : 0;
  const keyword = searchParameters.get("keyword")?.slice(0, 100) ?? "";
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  useEffect(() => setDraftKeyword(keyword), [keyword, type]);
  const session = useAuthSessionQuery();
  const list = useQuery({
    queryKey: [...queryRoot, "list", type, keyword, page],
    queryFn: ({ signal }) => boardApi.list(type, keyword, page, signal),
  });
  const canCreate = session.data?.authenticated && (type !== "NOTICE" || session.data.administrator);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchParameters(draftKeyword.trim() ? { keyword: draftKeyword.trim().slice(0, 100) } : {});
  };
  const goPage = (nextPage: number) => setSearchParameters({ ...(keyword ? { keyword } : {}), page: String(nextPage) });

  return <section className="board-lab-panel">
    <div className="board-lab-heading">
      <div><h2>{boardLabels[type]}</h2><p>{type === "QNA" ? "질문을 남기면 관리자가 에디터로 답변합니다." : type === "GALLERY" ? "대표 이미지와 함께 글을 올립니다." : type === "GRID" ? "열을 눌러 정렬하고 필터를 적용해 보세요." : "글을 작성하고 찾아보세요."}</p></div>
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
              {type === "QNA" ? <span className="board-lab-status">{post.answered ? "답변 완료" : "답변 대기"}</span> : null}
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

function PostEditor({ type, existing }: { type: BoardType; existing?: BoardPost }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useAuthSessionQuery();
  const [searchParameters] = useSearchParams();
  const titleReference = useRef<HTMLInputElement>(null);
  const editorReference = useRef<HTMLDivElement>(null);
  const imageReference = useRef<HTMLDivElement>(null);
  const dateReference = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState<EditorContentValue>(existing ? {
    contentJson: existing.contentJson, contentHtml: existing.contentHtml, contentText: existing.contentText,
  } : emptyContent);
  const [imageFileId, setImageFileId] = useState<number | undefined>(existing?.imageFileId ?? undefined);
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const suggestedDate = searchParameters.get("date") ?? "";
  const [eventDate, setEventDate] = useState(existing?.eventDate ?? (/^\d{4}-\d{2}-\d{2}$/.test(suggestedDate) ? suggestedDate : ""));
  const [validationError, setValidationError] = useState("");
  const save = useMutation({
    mutationFn: () => {
      const input = { ...content, title: title.trim(), imageFileId: imageFileId ?? null, pinned,
        eventDate: type === "CALENDAR" ? eventDate : null,
        ...(existing ? { versionNumber: existing.versionNumber } : {}) };
      return existing ? boardApi.update(type, existing.postId, input) : boardApi.create(type, input);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryRoot });
      applicationNotification.success(existing ? "게시글을 수정했습니다." : "게시글을 등록했습니다.");
      navigate(postPath(type, saved.postId));
    },
    onError: showError,
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) { setValidationError("제목을 입력해 주세요."); titleReference.current?.focus(); return; }
    if (type === "CALENDAR" && !eventDate) { setValidationError("날짜를 선택해 주세요."); dateReference.current?.focus(); return; }
    if (!content.contentText.trim()) { setValidationError("본문을 입력해 주세요."); editorReference.current?.querySelector<HTMLElement>("[contenteditable=true]")?.focus(); return; }
    if (type === "GALLERY" && !imageFileId) { setValidationError("대표 이미지를 올려 주세요."); imageReference.current?.querySelector<HTMLElement>("[tabindex]")?.focus(); return; }
    setValidationError("");
    save.mutate();
  };
  if (session.isPending) return <div className="state-panel" role="status">로그인 상태를 확인하는 중입니다.</div>;
  if (!session.data?.authenticated) return <div className="state-panel error-state" role="alert">글쓰기는 로그인 후 이용할 수 있습니다.</div>;
  if (type === "NOTICE" && !session.data.administrator) return <div className="state-panel error-state" role="alert">공지 작성은 관리자만 할 수 있습니다.</div>;
  return <form className="board-lab-panel board-lab-editor" onSubmit={submit} noValidate>
    <h2>{existing ? "게시글 수정" : "새 게시글"}</h2>
    <label htmlFor="board-title">제목 *</label>
    <input ref={titleReference} id="board-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
    {type === "CALENDAR" ? <><label htmlFor="board-event-date">날짜 *</label>
      <input ref={dateReference} id="board-event-date" type="date" min="1900-01-01" max="2100-12-31" required value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></> : null}
    {type === "NOTICE" ? <label className="board-lab-checkbox"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> 목록 상단에 고정</label> : null}
    {type === "GALLERY" ? <div ref={imageReference}><ThumbnailImageUploader thumbnailImageUrl={imageFileId ? imageUrl(imageFileId) : undefined}
      handleThumbnailChange={(id) => setImageFileId(id)} title="갤러리 대표 이미지" description="갤러리 카드에 표시할 이미지를 올려 주세요." /></div> : null}
    <p className="board-lab-label">본문 *</p>
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
  const session = useAuthSessionQuery();
  const post = useQuery({ queryKey: [...queryRoot, "detail", type, postId], queryFn: ({ signal }) => boardApi.detail(type, postId, signal), staleTime: 30_000 });
  const remove = useMutation({ mutationFn: () => boardApi.delete(type, postId), onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryRoot });
    applicationNotification.success("게시글을 삭제했습니다."); navigate(boardPath(type));
  }, onError: (error) => { setConfirmOpen(false); showError(error); } });
  const removeAnswer = useMutation({ mutationFn: () => boardApi.deleteAnswer(postId), onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: [...queryRoot, "detail", type, postId] });
    void queryClient.invalidateQueries({ queryKey: [...queryRoot, "list", type] });
    applicationNotification.success("답변을 삭제했습니다.");
    setConfirmAnswerOpen(false);
  }, onError: (error) => { setConfirmAnswerOpen(false); showError(error); } });
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
    {type === "CALENDAR" && item.eventDate ? <p className="board-lab-status">날짜 {item.eventDate}</p> : null}
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
  const post = useQuery({ queryKey: [...queryRoot, "detail", type, postId], queryFn: ({ signal }) => boardApi.detail(type, postId, signal), staleTime: 30_000 });
  if (post.isPending) return <div className="state-panel" role="status">게시글을 불러오는 중입니다.</div>;
  if (post.isError) return <div className="state-panel error-state" role="alert">게시글을 불러오지 못했습니다. <button type="button" onClick={() => void post.refetch()}>다시 시도</button></div>;
  if (!post.data.canEdit) return <div className="state-panel error-state" role="alert">수정할 권한이 없습니다.</div>;
  return <PostEditor key={post.data.versionNumber} type={type} existing={post.data} />;
}

/** 목록·상세·작성·수정을 하나의 게시판 서비스로 연결하고, 본문에는 공통 Tiptap 에디터를 쓴다. */
export function BoardLabPage() {
  const { boardType, postId } = useParams();
  const { pathname } = useLocation();
  const type = parseBoardType(boardType);
  const id = validId(postId);
  if (!boardType) return <div className="board-lab"><h1>게시판 실습</h1><BoardTabs selected="GENERAL" /><BoardList type="GENERAL" /></div>;
  if (!type || (postId && !id)) return <div className="state-panel error-state" role="alert">게시판 주소가 올바르지 않습니다. <Link to={boardPath("GENERAL")}>일반 게시판으로 이동</Link></div>;
  const editing = pathname.endsWith("/edit");
  const creating = pathname.endsWith("/new");
  return <div className="board-lab"><h1>게시판 실습</h1><p>일반·공지·Q&A·갤러리·그리드·달력 게시판을 하나의 API와 에디터로 구현합니다.</p>
    <BoardTabs selected={type} />
    {creating ? <PostEditor type={type} /> : id && editing ? <BoardEditorLoader type={type} postId={id} /> : id ? <BoardDetail type={type} postId={id} /> : type === "CALENDAR" ? withLoading(<CalendarBoard />) : <BoardList type={type} />}
  </div>;
}
