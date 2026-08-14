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

const waitForSearchResponse = (
  delayMilliseconds: number,
  abortSignal: AbortSignal,
): Promise<void> => new Promise((resolve, reject) => {
  const timeoutId = window.setTimeout(resolve, delayMilliseconds);
  abortSignal.addEventListener("abort", () => {
    window.clearTimeout(timeoutId);
    reject(new DOMException("검색 요청이 취소되었습니다.", "AbortError"));
  }, { once: true });
});

export const searchLearningTopics = async (
  searchKeyword: string,
  scenario: SearchPracticeScenario,
  abortSignal: AbortSignal,
): Promise<LearningTopicSearchResult[]> => {
  const responseDelay = scenario === "slow" ? 2_000 : 500;
  await waitForSearchResponse(responseDelay, abortSignal);

  if (scenario === "error") {
    throw new Error("연습용 검색 서버 오류가 발생했습니다.");
  }
  if (scenario === "empty") {
    return [];
  }

  const normalizedKeyword = searchKeyword.trim().toLocaleLowerCase("ko-KR");
  return learningTopicSearchData.filter((topic) => (
    topic.topicTitle.toLocaleLowerCase("ko-KR").includes(normalizedKeyword)
    || topic.categoryName.toLocaleLowerCase("ko-KR").includes(normalizedKeyword)
    || topic.description.toLocaleLowerCase("ko-KR").includes(normalizedKeyword)
    || topic.keywords.some((keyword) => keyword.toLocaleLowerCase("ko-KR").includes(normalizedKeyword))
  )).slice(0, 6);
};

