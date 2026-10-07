/**
 * ============================================================================
 * localFeedApi.ts — "커서(cursor)"로 다음 묶음을 주는 가짜 피드 API
 * ============================================================================
 *
 * [페이지 번호 방식 vs 커서 방식]
 *   페이지 번호: "3페이지 주세요"  → 그 사이 새 글이 올라오면 한 칸씩 밀려 같은 글이 두 번 보인다.
 *   커서      : "마지막으로 본 글 다음부터 주세요" → 새 글이 올라와도 겹치지 않는다.
 *   무한 스크롤 피드는 보통 커서 방식을 쓴다. 여기서는 "다음에 읽을 위치(숫자)"를 커서로 쓴다.
 *
 * [응답 모양]
 *   { items: [...], nextCursor: 20 }   ← 다음 요청에 cursor=20을 보내면 이어서 받는다
 *   { items: [...], nextCursor: null } ← 더 받을 글이 없다(마지막)
 *
 * [연습해 보기]
 *   검색어에 "error"를 넣으면 일부러 실패한다. 오류 화면과 "다시 시도"를 확인해 보자.
 */

export interface FeedPost {
  postId: number;
  title: string;
  authorName: string;
  summary: string;
}

export interface FeedPage {
  items: FeedPost[];
  /** 다음 요청에 보낼 커서. null이면 마지막 묶음이다. */
  nextCursor: number | null;
}

export interface FeedPageRequest {
  cursor: number;
  keyword: string;
  pageSize?: number;
  /** TanStack Query가 넘겨주는 취소 신호. 검색어를 바꾸거나 화면을 떠나면 진행 중인 요청을 멈춘다. */
  signal?: AbortSignal;
}

// 실제 서버처럼 0.5초 늦게 응답해 "불러오는 중" 화면을 볼 수 있게 한다.
const SIMULATED_NETWORK_DELAY_MILLISECONDS = 500;
const DEFAULT_PAGE_SIZE = 10;
const topics = ["useState", "useEffect", "TanStack Query", "React Router", "Zod", "Zustand", "MSW", "Tiptap", "Vitest"];
const authors = ["김리액트", "박스프링", "이타입", "최쿼리"];

// 서버 DB 대신 쓰는 고정 데이터 95건. 매번 같은 결과가 나오도록 규칙으로 만든다.
const feedPosts: FeedPost[] = Array.from({ length: 95 }, (_, index) => {
  const postId = 95 - index; // 최신 글이 먼저 오도록 큰 번호부터
  const topic = topics[index % topics.length] ?? "React";
  return {
    postId,
    title: `${postId}번 글 · ${topic} 정리`,
    authorName: authors[index % authors.length] ?? "익명",
    summary: `${topic}을(를) 공부하며 정리한 내용입니다.`,
  };
});

/** 취소 신호(signal)를 받으면 기다리지 않고 바로 실패한다. */
const wait = (milliseconds: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("요청이 취소되었습니다.", "AbortError"));
      return;
    }
    // 시간이 지나면 resolve(성공). 그 전에 abort 신호가 오면 타이머를 지우고 reject(실패)한다.
    const timerId = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timerId);
      reject(new DOMException("요청이 취소되었습니다.", "AbortError"));
    // once: true → 신호를 한 번 받으면 이 리스너가 자동으로 제거된다(리스너가 쌓이지 않게).
    }, { once: true });
  });

export const getFeedPage = async ({ cursor, keyword, pageSize = DEFAULT_PAGE_SIZE, signal }: FeedPageRequest): Promise<FeedPage> => {
  await wait(SIMULATED_NETWORK_DELAY_MILLISECONDS, signal);
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (normalizedKeyword.includes("error")) throw new Error("피드를 불러오지 못했습니다. (연습용 실패)");

  // 검색어가 있으면 제목·요약에 포함된 글만, 없으면 전체.
  const matchedPosts = normalizedKeyword
    ? feedPosts.filter((post) => `${post.title} ${post.summary}`.toLowerCase().includes(normalizedKeyword))
    : feedPosts;
  // slice(시작, 끝): cursor번째부터 pageSize개를 잘라 온다. 원본 배열은 바뀌지 않는다.
  const items = matchedPosts.slice(cursor, cursor + pageSize);
  // 뒤에 글이 더 남아 있으면 다음 시작 위치를, 없으면 null(= 마지막 묶음)을 준다.
  const nextCursor = cursor + pageSize < matchedPosts.length ? cursor + pageSize : null;
  return { items, nextCursor };
};
