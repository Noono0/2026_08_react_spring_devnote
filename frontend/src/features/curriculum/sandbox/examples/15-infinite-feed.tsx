/**
 * 15단계 연습 — 무한 스크롤: useInfiniteQuery + 커서 방식 + IntersectionObserver
 *
 * 해 볼 것
 *  1. 한 번에 받는 글 수(PAGE_SIZE)를 바꿔 보세요.
 *  2. 맨 위로 이동 버튼을 추가해 보세요.
 */
import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider, useInfiniteQuery } from "@tanstack/react-query";

interface FeedPage { items: string[]; nextCursor: number | null; }
const TOTAL = 42;
const PAGE_SIZE = 8;

// 가짜 API: cursor 번째부터 PAGE_SIZE개를 주고, 다음 시작 위치(nextCursor)를 알려 준다. 끝이면 null.
const getFeedPage = async (cursor: number): Promise<FeedPage> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const items = Array.from({ length: Math.min(PAGE_SIZE, TOTAL - cursor) }, (_, index) => `${cursor + index + 1}번째 글`);
  return { items, nextCursor: cursor + PAGE_SIZE < TOTAL ? cursor + PAGE_SIZE : null };
};

const queryClient = new QueryClient();

function Feed() {
  const feedQuery = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) => getFeedPage(pageParam),
    initialPageParam: 0,
    // 다음 묶음의 pageParam. undefined를 돌려주면 "더 없음"(hasNextPage = false)
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feedQuery;

  // 목록 끝의 빈 div(sentinel)가 화면에 보이면 다음 묶음을 부른다.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(sentinel);
    // 정리 함수: 관찰을 끝내지 않으면 다시 그릴 때마다 관찰자가 쌓인다.
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (feedQuery.isPending) return <p>불러오는 중…</p>;
  if (feedQuery.isError) return <p className="error">피드를 불러오지 못했습니다.</p>;

  return (
    <main>
      <h1>무한 스크롤 피드</h1>
      <ul className="list">
        {/* data.pages = [1묶음, 2묶음, …] → 펼쳐서 한 목록으로 그린다 */}
        {feedQuery.data.pages.flatMap((page) => page.items).map((item) => <li key={item}>{item}</li>)}
      </ul>
      <div ref={sentinelRef} />
      <p className="muted">{isFetchingNextPage ? "다음 글을 불러오는 중…" : hasNextPage ? "스크롤하면 더 불러옵니다." : "마지막 글입니다."}</p>
    </main>
  );
}

export default function App() {
  return <QueryClientProvider client={queryClient}><Feed /></QueryClientProvider>;
}
