/**
 * ============================================================================
 * InfiniteFeedPracticePage.tsx — 【중급】 무한 스크롤 피드 (useInfiniteQuery)
 * ============================================================================
 *
 * 스크롤을 끝까지 내리면 다음 글 묶음을 자동으로 이어 붙이는 화면이다.
 *
 * [useQuery와 useInfiniteQuery의 차이]
 *   useQuery         → data 하나 (예: 1페이지 목록)
 *   useInfiniteQuery → data.pages 배열 (1묶음, 2묶음, 3묶음 …을 차곡차곡 보관)
 *   fetchNextPage()를 부를 때마다 getNextPageParam이 알려 준 커서로 다음 묶음을 받아 pages 끝에 붙인다.
 *
 * [바닥에 닿았는지 어떻게 아나? — IntersectionObserver]
 *   목록 맨 아래에 눈에 안 보이는 표시(sentinel) div를 둔다.
 *   브라우저가 "이 div가 화면에 들어왔다"고 알려 주면 그때 다음 묶음을 요청한다.
 *   ❌ scroll 이벤트로 매번 위치를 계산하기 → 스크롤할 때마다 수십 번 실행되어 느리다.
 *   ✓ IntersectionObserver → 화면에 들어오는 순간에만 한 번 알려 준다.
 *
 * [이 페이지에서 확인할 것]
 *   1. 검색어를 바꾸면 queryKey가 달라져 처음 묶음부터 새로 받는다.
 *   2. Effect 정리(cleanup)에서 observer.disconnect()를 부르지 않으면 화면을 떠나도 감시가 계속된다.
 *   3. 자동 로딩이 안 되는 환경(키보드 사용자, 오래된 브라우저)을 위해 "더 보기" 버튼도 둔다.
 *   4. 검색어에 "error"를 넣으면 오류 화면과 다시 시도를 확인할 수 있다.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { getFeedPage } from "@/features/practice/15-infinite-feed/api/localFeedApi";

export const InfiniteFeedPracticePage = () => {
  // 입력 중인 값(draftKeyword)과 실제 검색에 쓰는 값(keyword)을 나눈다.
  // 한 글자 입력할 때마다 새로 요청하지 않고 "검색" 버튼을 눌렀을 때만 바꾸기 위해서다.
  const [draftKeyword, setDraftKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
  // 목록 맨 아래 "감시 대상" div를 가리킬 ref. 렌더링이 끝난 뒤 실제 DOM 요소가 .current에 들어온다.
  const sentinelRef = useRef<HTMLDivElement>(null);

  const feedQuery = useInfiniteQuery({
    // 검색어가 키에 들어 있으므로 검색어가 바뀌면 다른 캐시가 되어 처음부터 다시 받는다.
    queryKey: ["practiceInfiniteFeed", keyword],
    // pageParam = 이번에 보낼 커서. 첫 요청에는 initialPageParam(0)이 들어온다.
    queryFn: ({ pageParam, signal }) => getFeedPage({ cursor: pageParam, keyword, signal }),
    initialPageParam: 0,
    // 방금 받은 묶음을 보고 "다음 커서"를 알려 준다. undefined를 돌려주면 hasNextPage가 false가 된다.
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  // 아래 Effect의 의존성 배열에 넣기 위해 필요한 값만 꺼내 둔다(feedQuery 객체 전체는 렌더링마다 새로 만들어진다).
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feedQuery;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    // 테스트 환경(jsdom)이나 오래된 브라우저에는 IntersectionObserver가 없다. 그때는 "더 보기" 버튼을 쓴다.
    if (!sentinel || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      // ★ 이미 다음 묶음을 받는 중이면 또 요청하지 않는다. 이 조건이 없으면 같은 요청이 여러 번 나간다.
      if (entries.some((entry) => entry.isIntersecting) && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    }, { rootMargin: "200px" }); // 바닥 200px 전부터 미리 불러와 기다리는 시간을 줄인다.
    observer.observe(sentinel);
    // ★ 정리 함수: 화면을 떠나거나 의존값이 바뀌면 이전 감시를 끊는다.
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // 폼 제출(Enter 또는 검색 버튼) 때만 실제 검색어를 바꾼다. preventDefault: 페이지 새로고침을 막는다.
  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setKeyword(draftKeyword.trim());
  };

  // pages = [[1~10번 글], [11~20번 글], ...] 이므로 flatMap으로 한 줄로 편다.
  const posts = feedQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-중급">중급</span>
          <LearningGuideTitle guideId="infinite-feed">무한 스크롤 피드</LearningGuideTitle>
          <p>useInfiniteQuery와 IntersectionObserver로 스크롤 끝에서 다음 글 묶음을 이어 붙입니다.</p>
        </div>
      </div>

      <form className="button-row" role="search" onSubmit={submitSearch}>
        <label>피드 검색<input value={draftKeyword} onChange={(event) => setDraftKeyword(event.target.value)} placeholder="예: Query · error 입력 시 실패" /></label>
        <button type="submit">검색</button>
      </form>

      {/* isPending: 아직 첫 묶음도 받지 못한 상태. 다음 묶음을 받는 중(isFetchingNextPage)과는 다르다. */}
      {feedQuery.isPending ? <div className="state-panel" role="status">피드를 불러오는 중입니다.</div> : null}

      {/* 첫 묶음부터 실패한 경우. 이미 받은 묶음이 있으면 목록은 그대로 두고 아래에서 다시 시도한다. */}
      {feedQuery.isError && posts.length === 0 ? (
        <div className="state-panel error-state" role="alert">
          <p>{feedQuery.error.message}</p>
          <button type="button" onClick={() => void feedQuery.refetch()}>다시 시도</button>
        </div>
      ) : null}

      {/* 요청은 성공했지만 결과가 0건인 "빈 결과" 상태 */}
      {feedQuery.isSuccess && posts.length === 0 ? <div className="state-panel">검색어에 맞는 글이 없습니다.</div> : null}

      {posts.length > 0 ? (
        <ol className="practice-feed-list" aria-label="피드 글 목록">
          {/* key는 배열 순서(index)가 아니라 글 번호를 쓴다. 묶음이 추가돼도 기존 항목의 key가 바뀌지 않는다. */}
          {posts.map((post) => (
            <li className="practice-card" key={post.postId}>
              <h2>{post.title}</h2>
              <p>{post.summary}</p>
              <small>{post.authorName}</small>
            </li>
          ))}
        </ol>
      ) : null}

      {/* 화면에 들어오면 다음 묶음을 요청하는 감시 대상. 눈에 보이지 않는다. */}
      <div ref={sentinelRef} aria-hidden="true" />

      {/* aria-live="polite": 안의 글자가 바뀌면 화면 낭독기가 하던 말을 마친 뒤 읽어 준다("모든 글을 불러왔습니다" 등). */}
      {posts.length > 0 ? (
        <div className="practice-feed-footer" aria-live="polite">
          {/* 다음 묶음만 실패한 경우: 이미 받은 목록은 그대로 두고 오류 문구와 "더 보기"로 다시 시도하게 한다. */}
          {feedQuery.isFetchNextPageError ? <p className="field-error">다음 글을 불러오지 못했습니다.</p> : null}
          {hasNextPage ? (
            <button type="button" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
            </button>
          ) : <p>모든 글을 불러왔습니다. (총 {posts.length}건)</p>}
        </div>
      ) : null}
    </section>
  );
};
