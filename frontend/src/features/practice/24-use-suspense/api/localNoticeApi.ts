/**
 * 공지 목록을 "서버에서 받는 척"하는 가짜 API와, use()에 넘길 Promise 보관함.
 *
 * ★ use(promise)는 렌더링 중에 Promise를 받는다. 렌더링할 때마다 새 Promise를 만들면
 *   끝나기도 전에 또 새로 만들어 영원히 "로딩 중"이 된다.
 *   그래서 같은 요청(같은 key)이면 이미 만든 Promise를 다시 돌려주도록 Map에 보관한다.
 *   (실무에서는 TanStack Query의 useSuspenseQuery 같은 도구가 이 보관을 대신한다)
 */

export interface PracticeNotice {
  noticeId: number;
  title: string;
}

const SIMULATED_NETWORK_DELAY_MILLISECONDS = 600;
// key(요청 번호 + 성공/실패 여부) → 그 요청의 Promise. 모듈 변수라 컴포넌트가 다시 그려져도 유지된다.
const noticePromiseCache = new Map<string, Promise<PracticeNotice[]>>();

const fetchNotices = async (shouldFail: boolean): Promise<PracticeNotice[]> => {
  await new Promise((resolve) => window.setTimeout(resolve, SIMULATED_NETWORK_DELAY_MILLISECONDS));
  if (shouldFail) throw new Error("공지를 불러오지 못했습니다. (연습용 실패)");
  return [
    { noticeId: 1, title: "React 19 Actions 단계가 추가되었습니다" },
    { noticeId: 2, title: "업무 History에 태그 필터가 생겼습니다" },
    { noticeId: 3, title: "PDF로 저장 기능을 써 보세요" },
  ];
};

/** attempt가 바뀌면(다시 시도) 새 요청을 만든다. 같은 attempt면 같은 Promise를 돌려준다. */
export const getNoticePromise = (attempt: number, shouldFail: boolean): Promise<PracticeNotice[]> => {
  // 같은 조건이면 이미 만든 Promise를 돌려주고, 처음 보는 조건일 때만 새로 요청한다.
  const cacheKey = `${attempt}-${shouldFail ? "fail" : "ok"}`;
  const cachedPromise = noticePromiseCache.get(cacheKey);
  if (cachedPromise) return cachedPromise;
  const promise = fetchNotices(shouldFail);
  noticePromiseCache.set(cacheKey, promise);
  return promise;
};

/** 테스트에서 보관함을 비우기 위한 함수 */
export const clearNoticePromiseCache = (): void => noticePromiseCache.clear();
