import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { Pagination } from "@/shared/ui/Pagination";
import { boardApi, categoryLabels, communityCategories, parseCategory, type CommunityCategory } from "./boardApi";

/** 분류는 서버 검색 조건이다. 한 페이지씩 합치지 않고 서버에서 전체 건수와 정렬을 계산한다. */
export function CommunityBoardList({ legacyCategory }: { legacyCategory?: CommunityCategory }) {
  const [parameters, setParameters] = useSearchParams();
  const navigate = useNavigate();
  const rawCategory = parameters.get("category") ?? legacyCategory ?? "";
  const category = parseCategory(rawCategory);
  const invalidCategory = Boolean(rawCategory && !category);
  const keyword = parameters.get("keyword")?.slice(0, 100) ?? "";
  const rawPage = Number(parameters.get("page") ?? "0");
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 100000 ? rawPage : 0;
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  useEffect(() => setDraftKeyword(keyword), [keyword]);
  const session = useAuthSessionQuery();
  const result = useQuery({ queryKey: ["board-lab", "community", category ?? "ALL", keyword, page],
    queryFn: ({ signal }) => boardApi.communityList(category, keyword, page, signal), enabled: !invalidCategory });
  const filters = { ...(category ? { category } : {}), ...(keyword ? { keyword } : {}) };
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draftKeyword.trim();
    setParameters({ ...(category ? { category } : {}), ...(next ? { keyword: next } : {}) });
  };
  if (invalidCategory) return <div role="alert" className="state-panel error-state">게시글 분류가 올바르지 않습니다. <Link to="/react/boards/community">전체 글 보기</Link></div>;
  return <section className="board-lab-panel">
    <div className="board-lab-heading"><div><h2>통합 게시판</h2><p>일반 글·공지·질문을 한곳에서 보고, 분류에 맞춰 작성합니다.</p></div>
      {session.data?.authenticated ? <Link className="primary-link" to={`/react/boards/community/new${category && (category !== "NOTICE" || session.data.administrator) ? `?category=${category}` : ""}`}>글쓰기</Link> : null}</div>
    {!session.data?.authenticated && !session.isPending ? <p className="board-lab-hint">글을 작성하려면 로그인해 주세요.</p> : null}
    <form className="board-lab-search" role="search" onSubmit={search}>
      <label htmlFor="community-category">게시글 분류</label>
      <select id="community-category" value={category ?? ""} onChange={(event) => {
        const next = new URLSearchParams({ ...(parseCategory(event.target.value) ? { category: event.target.value } : {}), ...(keyword ? { keyword } : {}) });
        navigate(`/react/boards/community${next.size ? `?${next.toString()}` : ""}`);
      }}><option value="">전체</option>{communityCategories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}</select>
      <label htmlFor="community-keyword">제목·내용 검색</label>
      <input id="community-keyword" value={draftKeyword} maxLength={100} onChange={(event) => setDraftKeyword(event.target.value)} />
      <button type="submit">검색</button>
    </form>
    {result.isPending ? <p role="status">게시글을 불러오는 중입니다.</p> : null}
    {result.isError ? <div role="alert" className="state-panel error-state">게시글을 불러오지 못했습니다. <button type="button" onClick={() => void result.refetch()}>다시 시도</button></div> : null}
    {result.data ? <><p className="board-lab-count">전체 {result.data.pageInformation.totalElements}건</p>
      {result.data.content.length === 0 ? <p className="state-panel">검색 결과가 없습니다.</p> : <ul className="board-lab-list">
        {result.data.content.map((post) => <li key={post.postId}><Link to={`/react/boards/${post.boardType.toLowerCase()}/${post.postId}`}>
          <div className="board-lab-item-content"><div className="board-lab-badges"><span className="board-lab-status">{post.boardType === "NOTICE" ? "공지" : post.boardType === "QNA" ? "Q&A" : "일반"}</span>
            {post.pinned ? <span className="board-lab-status">상단 고정</span> : null}
            {post.boardType === "QNA" ? <span className="board-lab-status">{post.answered ? "답변 완료" : "답변 대기"}</span> : null}</div>
            <strong>{post.title}</strong><p>{post.contentPreview}</p>
            <small>{post.authorName} · {new Date(post.createdAt).toLocaleDateString("ko-KR")} · 조회 {post.viewCount}</small>
          </div></Link></li>)}
      </ul>}
      <Pagination pageInformation={result.data.pageInformation} handlePageChange={(next) => setParameters({ ...filters, page: String(next) })} />
    </> : null}
  </section>;
}
