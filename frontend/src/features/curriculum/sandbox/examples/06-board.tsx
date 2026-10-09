/**
 * 6단계 연습 — 일반 게시판: 목록·상세·작성 화면 전환, 검색, 페이지네이션
 *
 * 해 볼 것
 *  1. 작성자로도 검색되게 해 보세요. (filtered 계산 부분)
 *  2. 한 페이지에 보이는 글 수를 3에서 5로 바꿔 보세요.
 */
import { useState } from "react";

interface Post { id: number; title: string; content: string; author: string; }
type Screen = { name: "LIST" } | { name: "DETAIL"; postId: number } | { name: "WRITE" };

const PAGE_SIZE = 3;
const initialPosts: Post[] = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1, title: `${index + 1}번째 글`, content: `${index + 1}번째 글의 내용입니다.`, author: index % 2 === 0 ? "김리액트" : "박스프링",
}));

export default function App() {
  const [posts, setPosts] = useState(initialPosts);
  // 지금 어떤 화면인지를 State 하나로 표현한다(판별 유니온).
  const [screen, setScreen] = useState<Screen>({ name: "LIST" });
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // 검색 결과와 현재 페이지는 State가 아니라 매번 계산한다(원본과 어긋날 일이 없다).
  const filtered = posts.filter((post) => post.title.includes(keyword));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagePosts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const save = () => {
    if (!title.trim()) return;
    setPosts((previous) => [{ id: Date.now(), title: title.trim(), content, author: "학습자" }, ...previous]);
    setTitle(""); setContent(""); setScreen({ name: "LIST" });
  };

  if (screen.name === "DETAIL") {
    const post = posts.find((item) => item.id === screen.postId);
    return (
      <main>
        <h1>{post?.title ?? "없는 글입니다"}</h1>
        <p className="muted">{post?.author}</p>
        <div className="card">{post?.content}</div>
        <button className="secondary" onClick={() => setScreen({ name: "LIST" })}>목록으로</button>
      </main>
    );
  }

  if (screen.name === "WRITE") {
    return (
      <main>
        <h1>글쓰기</h1>
        <label>제목<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>내용<textarea rows={4} value={content} onChange={(event) => setContent(event.target.value)} /></label>
        <div className="row"><button onClick={save}>등록</button><button className="secondary" onClick={() => setScreen({ name: "LIST" })}>취소</button></div>
      </main>
    );
  }

  return (
    <main>
      <h1>게시판</h1>
      <div className="row">
        {/* 검색어가 바뀌면 1페이지로 돌아간다. 3페이지에서 검색하면 결과가 없어 보이는 실수를 막는다. */}
        <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="제목 검색" />
        <button onClick={() => setScreen({ name: "WRITE" })}>글쓰기</button>
      </div>
      <ul className="list">
        {pagePosts.map((post) => (
          <li key={post.id}>
            <button className="secondary" onClick={() => setScreen({ name: "DETAIL", postId: post.id })}>{post.title}</button>
            <span className="muted">{post.author}</span>
          </li>
        ))}
        {pagePosts.length === 0 ? <li className="muted">검색 결과가 없습니다.</li> : null}
      </ul>
      <div className="row">
        <button className="secondary" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>이전</button>
        <span>{page} / {totalPages}</span>
        <button className="secondary" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>다음</button>
      </div>
    </main>
  );
}
