/**
 * ============================================================================
 * searchTypes.ts — 자동완성 검색 기능이 쓰는 타입
 * ============================================================================
 */

/**
 * 연습용 응답 시나리오.
 *
 * 화면 위쪽 드롭다운에서 이 값을 바꾸면
 * 가짜 API가 각각 다르게 동작해 여러 상황을 재현할 수 있다.
 *   success 정상 응답 (0.5초)
 *   slow    느린 응답 (2초)  → 취소 동작을 실험하기 좋다
 *   empty   결과 0건        → "결과 없음" 화면 확인
 *   error   서버 오류        → 오류 화면 확인
 *
 * ★ 이렇게 실패 상황을 손쉽게 재현할 수 있게 만들어 두면
 *   "성공했을 때만 잘 되는 화면"을 만드는 실수를 피할 수 있다.
 */
export type SearchPracticeScenario = "success" | "slow" | "empty" | "error";

/** 검색 결과 항목 하나. */
export interface LearningTopicSearchResult {
  topicId: number;
  topicTitle: string;
  categoryName: string;
  description: string;
  // `string[]` = 문자열들의 배열. 검색 대상에 이 태그들도 포함된다.
  keywords: string[];
}
