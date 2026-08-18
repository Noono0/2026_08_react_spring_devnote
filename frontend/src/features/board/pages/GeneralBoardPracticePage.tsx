/**
 * ============================================================================
 * GeneralBoardPracticePage.tsx — 【중급】 게시판: 화면 전환 + 검색 + 페이지네이션
 * ============================================================================
 *
 * 우리가 흔히 보는 게시판을 그대로 만들어 본다.
 *   목록 → 글 클릭 → 상세 → 수정 → 목록으로
 *
 * [이 페이지만의 특징 — 라우팅 없이 화면 전환하기]
 *   보통 게시판은 /posts, /posts/1, /posts/new 처럼 주소가 바뀐다.
 *   그런데 이 페이지는 주소를 하나만 쓰고, State 값으로 화면을 갈아 끼운다.
 *
 *     boardScreen === "LIST"   → 목록 화면
 *     boardScreen === "FORM"   → 작성/수정 화면
 *     boardScreen === "DETAIL" → 상세 화면
 *
 *   ★ 장단점을 알아 두자.
 *     장점: 라우팅 설정이 필요 없고 구조가 단순하다. State 공유가 쉽다.
 *     단점: 상세 화면 주소를 복사해 공유할 수 없고, 뒤로가기가 안 먹는다.
 *     → 실무에서는 보통 라우팅을 쓴다.
 *       (진짜 라우팅 방식은 document 기능의 List/Detail/Editor 페이지에서 배운다)
 *
 * [배울 개념]
 *   조건부 early return으로 화면 나누기 / 검색 + 정렬 + 페이지네이션을 순서대로 적용하기
 *   / Array.from으로 데이터 만들기 / 잘못된 페이지 번호 방어하기
 */

import { useMemo, useState } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

type BoardVisibility = "PUBLIC" | "PRIVATE";

// 지금 어떤 화면을 보여줄지 나타내는 값. 이 State 하나가 화면 전체를 결정한다.
type BoardScreen = "LIST" | "FORM" | "DETAIL";

interface BoardPost {
  postId: number;
  title: string;
  content: string;
  authorName: string;
  visibility: BoardVisibility;  // 공개/비공개
  viewCount: number;            // 조회수
  createdAt: string;
  updatedAt: string;
}

/**
 * 연습용 샘플 글 13개를 코드로 만들어 낸다.
 *
 * ★ Array.from({ length: 13 }, (_, index) => ...) 문법 해설
 *   `{ length: 13 }` = "길이가 13인 것처럼 생긴 객체".
 *   Array.from은 이걸 보고 13칸짜리 배열을 만들고,
 *   각 칸마다 두 번째 인자의 함수를 실행해 값을 채운다.
 *
 *   `_` (밑줄): 첫 번째 매개변수를 안 쓴다는 표시.
 *              (실제 원소 값인데 여기서는 index만 필요하다)
 *              이름을 안 지을 수는 없으니 관례적으로 밑줄을 쓴다.
 *
 *   왜 13개를 손으로 안 쓰고 이렇게 만들까?
 *     - 페이지네이션을 시험하려면 데이터가 여러 개 필요하다
 *     - 손으로 쓰면 13 × 8줄 = 100줄이 넘는다
 *     - 개수를 20개로 바꾸고 싶을 때 숫자 하나만 고치면 된다
 */
const initialBoardPosts: BoardPost[] = Array.from({ length: 13 }, (_, index) => ({
  postId: index + 1, // index는 0부터 시작하므로 +1 해서 1번부터 만든다
  title: `${index + 1}번째 React 게시판 연습 글`,
  content: `목록, 상세, 작성, 수정, 삭제를 별도 화면처럼 전환하는 연습용 본문입니다. 글 번호는 ${index + 1}입니다.`,
  // `%`(나머지 연산자)로 값을 번갈아 넣는 요령.
  //   index % 2 === 0 → 짝수 번째만 참 → 두 사람이 번갈아 작성자가 된다
  authorName: index % 2 === 0 ? "김리액트" : "박스프링",
  //   index % 4 === 0 → 네 개마다 하나씩 비공개
  visibility: index % 4 === 0 ? "PRIVATE" : "PUBLIC",
  viewCount: 10 + index * 7, // 조회수를 제각각으로 만들어 실제 데이터처럼 보이게 한다
  // 날짜 문자열 만들기.
  //   Math.min(index + 1, 28) → 28일을 넘지 않게 자른다 (2월에도 안전한 날짜)
  //   String(...).padStart(2, "0") → 한 자리면 앞에 0을 채운다 ("5" → "05")
  createdAt: `2026-08-${String(Math.min(index + 1, 28)).padStart(2, "0")}`,
  updatedAt: `2026-08-${String(Math.min(index + 1, 28)).padStart(2, "0")}`,
}));

// 한 페이지에 보여줄 글 개수.
// 상수로 빼 두면 여러 계산식에서 같은 값을 쓰게 되어 어긋날 일이 없다.
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

  // ── 1단계: 검색 + 정렬 ──────────────────────────────────────────
  const filteredBoardPosts = useMemo(() => {
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();

    // ★★ `[...boardPosts]` 로 복사본을 먼저 만드는 것이 아주 중요하다!
    //
    //   아래에서 쓰는 .sort()는 원본 배열을 직접 정렬해 버리는 함수다.
    //   (map, filter와 달리 sort는 새 배열을 만들지 않는다. 자주 헷갈리는 부분이다)
    //
    //   복사 없이 boardPosts.sort(...)를 하면 State 배열을 직접 바꾸는 셈이라
    //   불변성이 깨진다. 그러면 React가 변화를 못 알아채서
    //   "데이터는 바뀌었는데 화면은 그대로"인 유령 버그가 생긴다.
    //
    //   ※ .filter()가 먼저 새 배열을 만들어 주긴 하지만,
    //     읽는 사람이 그걸 매번 따져 봐야 한다면 좋은 코드가 아니다.
    //     복사본을 명시적으로 만드는 게 안전하고 의도도 분명하다.
    return [...boardPosts]
      // 제목, 내용, 작성자 중 하나라도 검색어를 포함하면 통과.
      .filter((boardPost) => (
        boardPost.title.toLowerCase().includes(normalizedSearchKeyword)
        || boardPost.content.toLowerCase().includes(normalizedSearchKeyword)
        || boardPost.authorName.toLowerCase().includes(normalizedSearchKeyword)
      ))
      // 최신 글이 위로 오도록 내림차순 정렬.
      //
      // ★ sort의 비교 함수 규칙:
      //   음수를 반환 → 첫 번째를 앞으로
      //   양수를 반환 → 두 번째를 앞으로
      //
      //   second - first → 큰 id가 앞으로 (내림차순)
      //   first - second → 작은 id가 앞으로 (오름차순)
      //   순서만 바꾸면 정렬 방향이 뒤집힌다.
      .sort((firstPost, secondPost) => secondPost.postId - firstPost.postId);
  }, [boardPosts, searchKeyword]);

  // ── 2단계: 페이지네이션 계산 ────────────────────────────────────
  //
  // 전체 페이지 수 = 올림(전체 개수 ÷ 페이지 크기)
  //   13개 ÷ 5개 = 2.6 → 올림 → 3페이지 (마지막 페이지에 3개가 남는다)
  //   ceil(올림)을 쓰지 않고 그냥 나누면 마지막 3개를 볼 수 없게 된다.
  //
  // Math.max(1, ...) 로 감싼 이유:
  //   검색 결과가 0개면 0 ÷ 5 = 0페이지가 되어 페이지 버튼이 하나도 안 나온다.
  //   최소 1페이지는 있어야 화면이 자연스럽다.
  const totalPages = Math.max(1, Math.ceil(filteredBoardPosts.length / PAGE_SIZE));

  // ★ 안전한 페이지 번호.
  //   3페이지를 보다가 검색을 해서 결과가 1페이지 분량으로 줄면
  //   pageNumber는 여전히 3이라 빈 화면이 나온다.
  //   Math.min으로 "있는 페이지 중 마지막"을 넘지 않게 잘라 준다.
  //
  //   State를 직접 고치지 않고 계산으로 해결한 점에 주목하자.
  //   useEffect로 setPageNumber를 부르면 화면이 두 번 그려지고 복잡해진다.
  //   "계산으로 해결할 수 있으면 State를 늘리지 않는다"가 React의 좋은 습관이다.
  const safePageNumber = Math.min(pageNumber, totalPages);

  // slice(시작, 끝): 배열의 일부만 잘라 새 배열을 만든다. (원본은 그대로)
  //   1페이지 → slice(0, 5)  → 0,1,2,3,4번
  //   2페이지 → slice(5, 10) → 5,6,7,8,9번
  //   끝 번호는 포함되지 않는다는 점에 주의.
  const visibleBoardPosts = filteredBoardPosts.slice((safePageNumber - 1) * PAGE_SIZE, safePageNumber * PAGE_SIZE);

  // 상세 화면에 보여줄 글을 찾는다.
  //
  // ★ 선택한 글 "객체"를 State에 저장하지 않고 id만 저장한 뒤 매번 찾는 이유
  //   객체를 저장해 두면, 그 글을 수정했을 때 State 안의 사본은 옛날 값 그대로다.
  //   상세 화면에 수정 전 내용이 계속 보이는 버그가 난다.
  //   id로 매번 찾으면 항상 최신 데이터를 보게 된다.
  //   "같은 데이터를 두 곳에 두지 않는다"는 원칙이다.
  //
  // find는 못 찾으면 undefined를 돌려주는데, `?? null`로 null로 통일했다.
  // (아래에서 `&& selectedBoardPost` 로 확인하기 편하게 하기 위해서다)
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

  /** 상세 화면으로 이동하면서 조회수를 1 올린다. */
  const openDetailScreen = (boardPost: BoardPost): void => {
    // 조회수 증가도 결국 "수정"이므로 map 패턴을 그대로 쓴다.
    //
    // ★ 실제 게시판이라면 여기서 서버에 조회수 증가 요청을 보낸다.
    //   그리고 새로고침할 때마다 조회수가 오르는 걸 막으려고
    //   세션이나 쿠키로 중복 조회를 걸러 낸다.
    //   (지금은 State만 다루는 연습이므로 그런 처리는 없다)
    setBoardPosts((previousBoardPosts) => previousBoardPosts.map((previousBoardPost) => (
      previousBoardPost.postId === boardPost.postId
        ? { ...previousBoardPost, viewCount: previousBoardPost.viewCount + 1 }
        : previousBoardPost
    )));
    setSelectedPostId(boardPost.postId);
    // 이 한 줄로 화면이 통째로 상세 화면으로 바뀐다.
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

    // 오늘 날짜를 "2026-08-15" 형태로 만든다.
    //   toISOString() → "2026-08-15T14:30:00.000Z"
    //   slice(0, 10)  → 앞 10글자만 → "2026-08-15"
    // 간단하고 널리 쓰이는 요령이다.
    // (다만 toISOString은 UTC 기준이라 한국 시간과 하루 차이가 날 수 있다.
    //  정확한 날짜가 중요한 실무에서는 date-fns 같은 라이브러리를 쓴다)
    const currentDate = new Date().toISOString().slice(0, 10);

    // editingPostId가 null이면 새 글, 아니면 수정.
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
    // ★ 1페이지로 되돌리는 이유
    //   새 글은 정렬상 맨 앞에 오는데, 사용자가 3페이지를 보고 있었다면
    //   글을 등록하고도 자기 글이 안 보인다. "등록이 안 됐나?" 하고 오해한다.
    setPageNumber(1);
    setBoardScreen("LIST");
  };

  /** 【Delete】 확인 창에서 삭제를 눌렀을 때. */
  const deleteBoardPost = (): void => {
    if (!deleteTargetPost) return;

    setBoardPosts((previousBoardPosts) => previousBoardPosts.filter((boardPost) => boardPost.postId !== deleteTargetPost.postId));

    // ★ 이 처리를 빼먹으면 버그가 난다.
    //   상세 화면에서 그 글을 지웠는데 화면은 그대로 상세 화면이면
    //   보여줄 글이 없어서 빈 화면이 나온다.
    //   "지금 보고 있는 것을 지웠으면 목록으로 돌아간다"는 처리가 필요하다.
    //   삭제 기능을 만들 때 항상 "지금 이걸 보고 있진 않나?"를 생각하자.
    if (selectedPostId === deleteTargetPost.postId) {
      setSelectedPostId(null);
      setBoardScreen("LIST");
    }

    applicationNotification.success("게시글을 삭제했습니다.");
    setDeleteTargetPost(null);
  };

  // ══════════════════════════════════════════════════════════════════
  // ★★ 화면 전환의 핵심 — 조건에 따라 return을 나눈다.
  //
  //   컴포넌트 하나가 세 가지 화면을 모두 그린다.
  //   위에서부터 조건을 확인하다가 맞으면 그 화면을 return하고 함수가 끝난다.
  //   아래 코드는 아예 실행되지 않는다.
  //
  //   [주의] 이 return들은 반드시 모든 훅(useState, useMemo) 아래에 있어야 한다.
  //     훅보다 위에서 return하면 어떤 때는 훅이 실행되고 어떤 때는 안 되는데,
  //     React는 "훅이 항상 같은 순서로 같은 개수만큼 실행"되어야 동작한다.
  //     이 규칙을 어기면 "Rendered fewer hooks than expected" 에러가 난다.
  //     이것이 "훅은 컴포넌트 최상단에서만 호출한다"는 규칙의 이유다.
  // ══════════════════════════════════════════════════════════════════

  // ── 화면 1: 작성/수정 폼 ────────────────────────────────────────
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
          {/* <select>도 input과 똑같이 value + onChange 한 쌍으로 다룬다.
              ★ `as BoardVisibility` 가 필요한 이유
                HTML의 select는 값을 항상 string으로 준다.
                우리 State는 "PUBLIC" | "PRIVATE" 만 받으므로 타입이 안 맞는다.
                option을 그 두 개만 뒀으니 다른 값이 올 수 없다는 걸
                개발자는 알지만 TypeScript는 모른다. 그래서 단언으로 알려 준다. */}
          <label>공개 상태<select value={visibility} onChange={(event) => setVisibility(event.target.value as BoardVisibility)}><option value="PUBLIC">공개</option><option value="PRIVATE">비공개</option></select></label>
          <label>내용<textarea value={content} onChange={(event) => setContent(event.target.value)} rows={12} /></label>
          <div className="button-row"><button type="button" onClick={saveBoardPost}>{editingPostId ? "수정 저장" : "게시글 등록"}</button><button type="button" className="ghost-button" onClick={() => { resetForm(); setBoardScreen("LIST"); }}>취소</button></div>
        </article>
      </section>
    );
  }

  // ── 화면 2: 상세 보기 ───────────────────────────────────────────
  // ★ `&& selectedBoardPost` 조건이 반드시 필요하다.
  //   DETAIL 모드인데 글이 삭제돼서 못 찾는 경우가 있을 수 있다.
  //   그때 이 조건이 없으면 아래에서 null의 속성을 읽다가 앱이 죽는다.
  //   조건이 안 맞으면 자연스럽게 맨 아래 목록 화면으로 넘어간다.
  if (boardScreen === "DETAIL" && selectedBoardPost) {
    return (
      <section>
        <div className="page-heading-row">
          <div><span className="level-badge level-중급">중급 · 상세 조회</span><h1>{selectedBoardPost.title}</h1><p>{selectedBoardPost.authorName} · 조회 {selectedBoardPost.viewCount.toLocaleString("ko-KR")} · {selectedBoardPost.updatedAt}</p></div>
          <div className="button-row"><button type="button" className="secondary-button" onClick={() => setBoardScreen("LIST")}>목록</button><button type="button" onClick={() => openUpdateScreen(selectedBoardPost)}>수정</button><button type="button" className="danger-button" onClick={() => setDeleteTargetPost(selectedBoardPost)}>삭제</button></div>
        </div>
        <article className="rendered-document-content board-detail-content"><span className={`visibility-badge visibility-${selectedBoardPost.visibility.toLowerCase()}`}>{selectedBoardPost.visibility === "PUBLIC" ? "공개" : "비공개"}</span><p>{selectedBoardPost.content}</p></article>
        {/* 삭제 확인 창.
            `deleteTargetPost?.title ?? ""` 는 옵셔널 체이닝 + null 병합의 조합이다.
            창이 닫히는 순간 deleteTargetPost가 null이 되는데,
            그때 화면이 깨지지 않도록 빈 문자열로 대체한다. */}
        <ConfirmDialog isOpen={deleteTargetPost !== null} title="게시글 삭제" description={`“${deleteTargetPost?.title ?? ""}” 글을 삭제할까요?`} confirmButtonLabel="삭제" onConfirm={deleteBoardPost} onCancel={() => setDeleteTargetPost(null)} />
      </section>
    );
  }

  // ── 화면 3: 목록 (위 조건에 다 안 걸리면 여기까지 온다) ──────────
  // 기본 화면이므로 if 없이 그냥 return한다.
  return (
    <section>
      <div className="page-heading-row">
        <div><span className="level-badge level-중급">중급 · 난이도 5/10</span><h1>일반 페이지형 게시판</h1><p>목록 → 작성 → 상세 → 수정 화면을 전환하고 검색·페이지네이션을 연습합니다.</p></div>
        <button type="button" onClick={openCreateScreen}>새 글 작성</button>
      </div>
      {/* ★ 검색어를 바꿀 때 페이지 번호도 1로 되돌린다.
          3페이지를 보다가 검색하면 결과가 1페이지뿐일 수 있다.
          위에서 safePageNumber로 방어해 두긴 했지만,
          "검색하면 처음부터 본다"가 사용자가 기대하는 동작이다.
          한 이벤트에서 State 두 개를 함께 바꾸는 흔한 패턴이기도 하다. */}
      <div className="search-panel board-search-panel"><label>통합 검색<input value={searchKeyword} onChange={(event) => { setSearchKeyword(event.target.value); setPageNumber(1); }} placeholder="제목, 내용, 작성자" /></label><div className="search-result-summary"><strong>{filteredBoardPosts.length}</strong><span>개의 검색 결과</span></div></div>
      <div className="table-wrapper"><table><thead><tr><th>번호</th><th>제목</th><th>공개</th><th>작성자</th><th>조회수</th><th>수정일</th></tr></thead><tbody>{visibleBoardPosts.map((boardPost) => <tr key={boardPost.postId}><td>{boardPost.postId}</td><td><button type="button" className="table-title-button" onClick={() => openDetailScreen(boardPost)}>{boardPost.title}</button></td><td>{boardPost.visibility === "PUBLIC" ? "공개" : "비공개"}</td><td>{boardPost.authorName}</td><td>{boardPost.viewCount}</td><td>{boardPost.updatedAt}</td></tr>)}</tbody></table></div>
      {visibleBoardPosts.length === 0 ? <div className="state-panel">검색 조건에 맞는 게시글이 없습니다.</div> : null}
      {/* 페이지 버튼 만들기.
          Array.from({ length: totalPages }, (_, index) => index + 1)
            → totalPages가 3이면 [1, 2, 3] 배열이 만들어진다.
          그걸 .map()으로 돌려 버튼을 그린다.
          페이지 수가 늘어나도 코드를 고칠 필요가 없다.

          ★ 목록 렌더링에는 visibleBoardPosts(잘라낸 것)를 쓰고,
            페이지 버튼에는 totalPages(전체 기준)를 쓴다는 점을 구분하자. */}
      <nav className="pagination" aria-label="게시글 페이지">{Array.from({ length: totalPages }, (_, index) => index + 1).map((pageOption) => <button type="button" key={pageOption} className={safePageNumber === pageOption ? "active" : ""} onClick={() => setPageNumber(pageOption)}>{pageOption}</button>)}</nav>
    </section>
  );
};
