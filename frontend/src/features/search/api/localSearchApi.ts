/**
 * ============================================================================
 * localSearchApi.ts — 자동완성 연습용 가짜 검색 API
 * ============================================================================
 *
 * localTaskApi처럼 서버 없이 API를 흉내 내지만, 두 가지가 더 있다.
 *   1. 시나리오(정상/느림/빈 결과/오류)를 골라 상황을 재현할 수 있다
 *   2. AbortSignal을 받아서 요청 취소를 실제로 지원한다  ← 아래가 핵심
 *
 * 화면 쪽 구현은 SearchAutocompletePracticePage.tsx를 보자.
 */

import type {
  LearningTopicSearchResult,
  SearchPracticeScenario,
} from "@/features/search/types/searchTypes";

const learningTopicSearchData: LearningTopicSearchResult[] = [
  { topicId: 1, topicTitle: "useState로 상태 시작하기", categoryName: "React 기초", description: "컴포넌트가 기억해야 하는 값을 State로 관리합니다.", keywords: ["상태", "렌더링", "초급"] },
  { topicId: 2, topicTitle: "배열을 불변하게 수정하기", categoryName: "React 기초", description: "map과 filter로 기존 배열을 직접 변경하지 않고 갱신합니다.", keywords: ["불변성", "배열", "CRUD"] },
  { topicId: 3, topicTitle: "useEffect와 정리 함수", categoryName: "Effect", description: "타이머와 외부 시스템 연결을 시작하고 안전하게 정리합니다.", keywords: ["cleanup", "생명주기", "타이머"] },
  { topicId: 4, topicTitle: "검색 요청 취소하기", categoryName: "비동기", description: "AbortController로 더 이상 필요하지 않은 요청을 중단합니다.", keywords: ["취소", "네트워크", "race condition"] },
  { topicId: 5, topicTitle: "Debounce 자동완성", categoryName: "비동기", description: "입력이 잠시 멈춘 뒤에만 검색하여 불필요한 요청을 줄입니다.", keywords: ["debounce", "검색", "자동완성"] },
  { topicId: 6, topicTitle: "TanStack Query 서버 상태", categoryName: "서버 상태", description: "캐시, 재시도, Mutation과 무효화를 이용해 API 상태를 관리합니다.", keywords: ["query", "cache", "mutation"] },
  { topicId: 7, topicTitle: "낙관적 업데이트와 롤백", categoryName: "서버 상태", description: "서버 응답 전에 화면을 갱신하고 실패하면 이전 상태로 복구합니다.", keywords: ["optimistic", "rollback", "mutation"] },
  { topicId: 8, topicTitle: "React Hook Form 검증", categoryName: "폼", description: "폼 입력과 오류를 효율적으로 관리하고 Zod 검증을 연결합니다.", keywords: ["form", "zod", "유효성"] },
  { topicId: 9, topicTitle: "Context와 Reducer", categoryName: "상태 설계", description: "여러 컴포넌트가 사용하는 상태와 변경 규칙을 함께 제공합니다.", keywords: ["context", "reducer", "전역 상태"] },
  { topicId: 10, topicTitle: "URL을 검색 상태로 사용하기", categoryName: "라우팅", description: "검색 조건을 URL에 보관해 새로고침과 뒤로 가기를 지원합니다.", keywords: ["router", "search params", "히스토리"] },
  { topicId: 11, topicTitle: "키보드 접근 가능한 Combobox", categoryName: "접근성", description: "방향키, Enter, Escape와 ARIA 속성을 갖춘 자동완성을 만듭니다.", keywords: ["a11y", "aria", "키보드"] },
  { topicId: 12, topicTitle: "useTransition으로 우선순위 나누기", categoryName: "성능", description: "긴 렌더링 중에도 중요한 입력 상호작용을 부드럽게 유지합니다.", keywords: ["transition", "동시성", "렌더링"] },
  { topicId: 13, topicTitle: "Error Boundary 오류 격리", categoryName: "오류 처리", description: "일부 UI의 렌더링 오류가 전체 화면을 무너뜨리지 않게 합니다.", keywords: ["error", "boundary", "복구"] },
  { topicId: 14, topicTitle: "MSW로 API 상황 재현하기", categoryName: "테스트", description: "성공, 지연, 빈 결과와 서버 오류를 브라우저와 테스트에서 재현합니다.", keywords: ["mock", "network", "test"] },
];

/**
 * ★★ "취소할 수 있는 기다리기"를 만든다. 이 파일에서 가장 배울 게 많은 부분이다.
 *
 * 보통의 setTimeout은 한번 걸면 중간에 멈출 수 없다.
 * 여기서는 Promise와 AbortSignal을 엮어 취소 가능한 대기를 만든다.
 *
 * [Promise의 두 결말]
 *   resolve(값)  → 성공. await가 그 값을 돌려주며 풀린다.
 *   reject(에러) → 실패. await 자리에서 에러가 던져진다.
 *
 * [여기서 벌어지는 경주]
 *   두 가지 중 먼저 일어나는 쪽이 이긴다.
 *     (A) 시간이 다 지남      → resolve → 정상 응답
 *     (B) 누가 abort()를 부름 → reject  → 취소 에러
 *   Promise는 한 번 결말이 나면 그 뒤 호출은 무시되므로 안전하다.
 */
const waitForSearchResponse = (
  delayMilliseconds: number,
  abortSignal: AbortSignal,
): Promise<void> => new Promise((resolve, reject) => {
  // (A) 정해진 시간 뒤 성공 처리.
  const timeoutId = window.setTimeout(resolve, delayMilliseconds);

  // (B) 취소 신호가 오면 실행될 처리를 등록해 둔다.
  abortSignal.addEventListener("abort", () => {
    // ★ 예약된 타이머를 반드시 지워야 한다.
    //   안 지우면 취소한 뒤에도 타이머가 살아 있어 메모리를 붙잡고 있는다.
    window.clearTimeout(timeoutId);

    // ★ 왜 그냥 new Error가 아니라 DOMException("...", "AbortError")일까?
    //   브라우저의 fetch가 취소될 때 던지는 것과 똑같은 모양을 맞춘 것이다.
    //   화면 쪽에서 `error.name === "AbortError"` 하나로
    //   진짜 fetch든 이 가짜 API든 똑같이 걸러낼 수 있다.
    //   "가짜라도 진짜와 같은 규칙을 따른다"는 게 좋은 모의 구현의 조건이다.
    reject(new DOMException("검색 요청이 취소되었습니다.", "AbortError"));

    // { once: true } → 한 번 실행되면 리스너가 자동으로 제거된다.
    // 직접 removeEventListener를 부를 필요가 없어 편하고 안전하다.
  }, { once: true });
});

/**
 * 학습 주제를 검색한다.
 *
 * @param searchKeyword 검색어
 * @param scenario      재현할 상황 (success / slow / empty / error)
 * @param abortSignal   취소 신호
 */
export const searchLearningTopics = async (
  searchKeyword: string,
  scenario: SearchPracticeScenario,
  abortSignal: AbortSignal,
): Promise<LearningTopicSearchResult[]> => {
  // "느린 응답" 시나리오는 2초, 나머지는 0.5초를 기다린다.
  // 2초 지연이 있어야 "요청 중에 검색어를 바꿔 취소되는" 상황을 실험할 수 있다.
  const responseDelay = scenario === "slow" ? 2_000 : 500;
  await waitForSearchResponse(responseDelay, abortSignal);

  // ★ 기다린 "뒤"에 시나리오를 판정한다.
  //   즉시 던지면 로딩 상태를 볼 수 없어 실제 서버 오류와 느낌이 달라진다.
  if (scenario === "error") {
    throw new Error("연습용 검색 서버 오류가 발생했습니다.");
  }
  if (scenario === "empty") {
    // ★ 빈 배열과 오류는 전혀 다른 결과다.
    //   빈 배열 = "정상적으로 처리했는데 맞는 게 없다"
    //   오류    = "처리 자체를 못 했다"
    //   화면에서 이 둘을 다르게 안내해야 하는 이유다.
    return [];
  }

  // ★ toLocaleLowerCase("ko-KR") — 그냥 toLowerCase()와 무엇이 다른가?
  //   언어권마다 대소문자 규칙이 다르다. 유명한 예가 터키어인데,
  //   대문자 "I"를 소문자로 바꾸면 영어는 "i", 터키어는 "ı"(점 없는 i)가 된다.
  //   지역을 명시하면 사용자의 브라우저 설정과 무관하게 결과가 일정해진다.
  //   한국어에는 대소문자가 없지만, 섞여 들어오는 영어를 위해 이렇게 쓴다.
  const normalizedKeyword = searchKeyword.trim().toLocaleLowerCase("ko-KR");

  return learningTopicSearchData.filter((topic) => (
    // 네 군데 중 하나라도 검색어를 포함하면 결과에 넣는다.
    topic.topicTitle.toLocaleLowerCase("ko-KR").includes(normalizedKeyword)
    || topic.categoryName.toLocaleLowerCase("ko-KR").includes(normalizedKeyword)
    || topic.description.toLocaleLowerCase("ko-KR").includes(normalizedKeyword)
    // keywords는 배열이므로 some()으로 "하나라도 맞는지" 확인한다.
    || topic.keywords.some((keyword) => keyword.toLocaleLowerCase("ko-KR").includes(normalizedKeyword))
    // ★ 최대 6개까지만 돌려준다.
    //   자동완성 목록이 화면을 다 덮을 만큼 길면 오히려 쓰기 불편하다.
    //   실제 서버 API에서도 이런 개수 제한을 두는 게 일반적이다.
  )).slice(0, 6);
};

