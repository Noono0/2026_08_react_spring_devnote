import { useMemo, useState } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

type BoardVisibility = "PUBLIC" | "PRIVATE";
type BoardScreen = "LIST" | "FORM" | "DETAIL";

interface BoardPost {
  postId: number;
  title: string;
  content: string;
  authorName: string;
  visibility: BoardVisibility;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

const initialBoardPosts: BoardPost[] = Array.from({ length: 13 }, (_, index) => ({
  postId: index + 1,
  title: `${index + 1}번째 React 게시판 연습 글`,
  content: `목록, 상세, 작성, 수정, 삭제를 별도 화면처럼 전환하는 연습용 본문입니다. 글 번호는 ${index + 1}입니다.`,
  authorName: index % 2 === 0 ? "김리액트" : "박스프링",
  visibility: index % 4 === 0 ? "PRIVATE" : "PUBLIC",
  viewCount: 10 + index * 7,
  createdAt: `2026-08-${String(Math.min(index + 1, 28)).padStart(2, "0")}`,
  updatedAt: `2026-08-${String(Math.min(index + 1, 28)).padStart(2, "0")}`,
}));

const PAGE_SIZE = 5;

export const GeneralBoardPracticePage = () => {
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>(initialBoardPosts);
  const [boardScreen, setBoardScreen] = useState<BoardScreen>("LIST");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("학습자");
  const [visibility, setVisibility] = useState<BoardVisibility>("PUBLIC");
  const [deleteTargetPost, setDeleteTargetPost] = useState<BoardPost | null>(null);

  const filteredBoardPosts = useMemo(() => {
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
    return [...boardPosts]
      .filter((boardPost) => (
        boardPost.title.toLowerCase().includes(normalizedSearchKeyword)
        || boardPost.content.toLowerCase().includes(normalizedSearchKeyword)
        || boardPost.authorName.toLowerCase().includes(normalizedSearchKeyword)
      ))
      .sort((firstPost, secondPost) => secondPost.postId - firstPost.postId);
  }, [boardPosts, searchKeyword]);

  const totalPages = Math.max(1, Math.ceil(filteredBoardPosts.length / PAGE_SIZE));
  const safePageNumber = Math.min(pageNumber, totalPages);
  const visibleBoardPosts = filteredBoardPosts.slice((safePageNumber - 1) * PAGE_SIZE, safePageNumber * PAGE_SIZE);
  const selectedBoardPost = boardPosts.find((boardPost) => boardPost.postId === selectedPostId) ?? null;

  const resetForm = (): void => {
    setEditingPostId(null);
    setTitle("");
    setContent("");
    setAuthorName("학습자");
    setVisibility("PUBLIC");
  };

  const openCreateScreen = (): void => {
    resetForm();
    setBoardScreen("FORM");
  };

  const openDetailScreen = (boardPost: BoardPost): void => {
    setBoardPosts((previousBoardPosts) => previousBoardPosts.map((previousBoardPost) => (
      previousBoardPost.postId === boardPost.postId
        ? { ...previousBoardPost, viewCount: previousBoardPost.viewCount + 1 }
        : previousBoardPost
    )));
    setSelectedPostId(boardPost.postId);
    setBoardScreen("DETAIL");
  };

  const openUpdateScreen = (boardPost: BoardPost): void => {
    setEditingPostId(boardPost.postId);
    setTitle(boardPost.title);
    setContent(boardPost.content);
    setAuthorName(boardPost.authorName);
    setVisibility(boardPost.visibility);
    setBoardScreen("FORM");
  };

  const saveBoardPost = (): void => {
    if (!title.trim() || !content.trim() || !authorName.trim()) {
      applicationNotification.warning("제목, 내용, 작성자를 모두 입력해 주세요.");
      return;
    }

    const currentDate = new Date().toISOString().slice(0, 10);
    if (editingPostId === null) {
      const newBoardPost: BoardPost = {
        postId: Date.now(),
        title: title.trim(),
        content: content.trim(),
        authorName: authorName.trim(),
        visibility,
        viewCount: 0,
        createdAt: currentDate,
        updatedAt: currentDate,
      };
      setBoardPosts((previousBoardPosts) => [newBoardPost, ...previousBoardPosts]);
      applicationNotification.success("게시글을 등록했습니다.");
    } else {
      setBoardPosts((previousBoardPosts) => previousBoardPosts.map((boardPost) => (
        boardPost.postId === editingPostId
          ? { ...boardPost, title: title.trim(), content: content.trim(), authorName: authorName.trim(), visibility, updatedAt: currentDate }
          : boardPost
      )));
      applicationNotification.success("게시글을 수정했습니다.");
    }

    resetForm();
    setPageNumber(1);
    setBoardScreen("LIST");
  };

  const deleteBoardPost = (): void => {
    if (!deleteTargetPost) return;
    setBoardPosts((previousBoardPosts) => previousBoardPosts.filter((boardPost) => boardPost.postId !== deleteTargetPost.postId));
    if (selectedPostId === deleteTargetPost.postId) {
      setSelectedPostId(null);
      setBoardScreen("LIST");
    }
    applicationNotification.success("게시글을 삭제했습니다.");
    setDeleteTargetPost(null);
  };

  if (boardScreen === "FORM") {
    return (
      <section>
        <div className="page-heading-row">
          <div><span className="level-badge level-중급">중급 · 난이도 5/10</span><h1>{editingPostId ? "게시글 수정" : "게시글 작성"}</h1><p>목록과 분리된 작성 화면에서 폼 상태와 저장 흐름을 연습합니다.</p></div>
          <button type="button" className="secondary-button" onClick={() => { resetForm(); setBoardScreen("LIST"); }}>목록으로</button>
        </div>
        <article className="practice-card board-editor-card">
          <label>제목<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label>
          <label>작성자<input value={authorName} onChange={(event) => setAuthorName(event.target.value)} maxLength={40} /></label>
          <label>공개 상태<select value={visibility} onChange={(event) => setVisibility(event.target.value as BoardVisibility)}><option value="PUBLIC">공개</option><option value="PRIVATE">비공개</option></select></label>
          <label>내용<textarea value={content} onChange={(event) => setContent(event.target.value)} rows={12} /></label>
          <div className="button-row"><button type="button" onClick={saveBoardPost}>{editingPostId ? "수정 저장" : "게시글 등록"}</button><button type="button" className="ghost-button" onClick={() => { resetForm(); setBoardScreen("LIST"); }}>취소</button></div>
        </article>
      </section>
    );
  }

  if (boardScreen === "DETAIL" && selectedBoardPost) {
    return (
      <section>
        <div className="page-heading-row">
          <div><span className="level-badge level-중급">중급 · 상세 조회</span><h1>{selectedBoardPost.title}</h1><p>{selectedBoardPost.authorName} · 조회 {selectedBoardPost.viewCount.toLocaleString("ko-KR")} · {selectedBoardPost.updatedAt}</p></div>
          <div className="button-row"><button type="button" className="secondary-button" onClick={() => setBoardScreen("LIST")}>목록</button><button type="button" onClick={() => openUpdateScreen(selectedBoardPost)}>수정</button><button type="button" className="danger-button" onClick={() => setDeleteTargetPost(selectedBoardPost)}>삭제</button></div>
        </div>
        <article className="rendered-document-content board-detail-content"><span className={`visibility-badge visibility-${selectedBoardPost.visibility.toLowerCase()}`}>{selectedBoardPost.visibility === "PUBLIC" ? "공개" : "비공개"}</span><p>{selectedBoardPost.content}</p></article>
        <ConfirmDialog isOpen={deleteTargetPost !== null} title="게시글 삭제" description={`“${deleteTargetPost?.title ?? ""}” 글을 삭제할까요?`} confirmButtonLabel="삭제" onConfirm={deleteBoardPost} onCancel={() => setDeleteTargetPost(null)} />
      </section>
    );
  }

  return (
    <section>
      <div className="page-heading-row">
        <div><span className="level-badge level-중급">중급 · 난이도 5/10</span><h1>일반 페이지형 게시판</h1><p>목록 → 작성 → 상세 → 수정 화면을 전환하고 검색·페이지네이션을 연습합니다.</p></div>
        <button type="button" onClick={openCreateScreen}>새 글 작성</button>
      </div>
      <div className="search-panel board-search-panel"><label>통합 검색<input value={searchKeyword} onChange={(event) => { setSearchKeyword(event.target.value); setPageNumber(1); }} placeholder="제목, 내용, 작성자" /></label><div className="search-result-summary"><strong>{filteredBoardPosts.length}</strong><span>개의 검색 결과</span></div></div>
      <div className="table-wrapper"><table><thead><tr><th>번호</th><th>제목</th><th>공개</th><th>작성자</th><th>조회수</th><th>수정일</th></tr></thead><tbody>{visibleBoardPosts.map((boardPost) => <tr key={boardPost.postId}><td>{boardPost.postId}</td><td><button type="button" className="table-title-button" onClick={() => openDetailScreen(boardPost)}>{boardPost.title}</button></td><td>{boardPost.visibility === "PUBLIC" ? "공개" : "비공개"}</td><td>{boardPost.authorName}</td><td>{boardPost.viewCount}</td><td>{boardPost.updatedAt}</td></tr>)}</tbody></table></div>
      {visibleBoardPosts.length === 0 ? <div className="state-panel">검색 조건에 맞는 게시글이 없습니다.</div> : null}
      <nav className="pagination" aria-label="게시글 페이지">{Array.from({ length: totalPages }, (_, index) => index + 1).map((pageOption) => <button type="button" key={pageOption} className={safePageNumber === pageOption ? "active" : ""} onClick={() => setPageNumber(pageOption)}>{pageOption}</button>)}</nav>
    </section>
  );
};
