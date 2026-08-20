/**
 * ============================================================================
 * pollRules.ts — 투표 기능의 규칙과 시간 계산
 * ============================================================================
 *
 * 투표 화면 여러 곳에서 쓰는 상수·계산을 모아 둔 파일이다.
 *
 * ★ 이런 값을 화면 컴포넌트 안에 흩어 두면
 *   "최대 10개"를 11개로 바꿀 때 고칠 곳을 찾아다녀야 한다.
 *   여기 모아 두면 한 곳만 고치면 되고, 순수 함수라 테스트도 쉽다.
 *   (pollRules.test.ts 에서 검증한다)
 */

import type { PollStatus } from "@/features/utility/types/pollTypes";

/** 한 투표에 만들 수 있는 최대 문항 수. 화면 검증과 안내 문구가 이 값을 함께 쓴다. */
export const MAXIMUM_POLL_OPTION_COUNT = 10;

/**
 * 투표 종료 시간의 최대 범위(분).
 *
 * 연습용 기능이라 60분으로 제한했다. 제한이 없으면
 * 몇 달 뒤에 끝나는 투표가 목록에 계속 쌓인다.
 */
export const MAXIMUM_POLL_DURATION_MINUTES = 60;

/** 상태 코드 → 화면에 보여줄 한국어. */
export const pollStatusLabels: Record<PollStatus, string> = {
  OPEN: "투표 중",
  CLOSED: "투표 종료",
  RESULTS_PUBLISHED: "투표 결과 공개",
};

/**
 * 문항별 득표율을 계산한다.
 *
 * ★ 0으로 나누는 것을 먼저 막는다.
 *   참여자가 0명일 때 그냥 나누면 결과가 NaN 이 되고,
 *   화면에는 "NaN%" 라는 글자가 그대로 찍힌다.
 *   `votes === null` 도 함께 거른다. 결과 비공개 상태에서는 표 수가 null 로 오기 때문이다.
 */
export const calculatePollPercentage = (votes: number | null, participantCount: number): number => {
  if (votes === null || participantCount === 0) return 0;
  // 복수 선택 투표는 각 문항을 선택한 참여자의 비율이며, 모든 막대의 합이 100%일 필요는 없습니다.
  return Math.round(votes / participantCount * 100);
};

/**
 * ★ Date 를 `<input type="datetime-local">` 이 요구하는 형식으로 바꾼다.
 *
 * [왜 그냥 toISOString() 을 못 쓰나]
 *   toISOString() 은 항상 UTC 기준으로 만든다.
 *   한국(UTC+9)에서 오후 3시를 넣으면 "06:00" 이 나와 9시간 어긋난다.
 *
 * [그래서 시차만큼 미리 더한다]
 *   getTimezoneOffset() 은 "UTC와 몇 분 차이인지"를 돌려주는데,
 *   한국은 -540(분)이다. 부호가 반대라 빼면 더해지는 셈이 된다.
 *   그렇게 만든 값을 UTC로 출력하면 결과적으로 현지 시각이 찍힌다.
 *
 * `slice(0, 16)` → "2026-08-19T15:00" 까지만 남긴다.
 * datetime-local 은 초 단위를 받지 않는다.
 */
export const toDateTimeLocalValue = (date: Date): string => {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
};

/**
 * "지금부터 N분 뒤"를 서버에 보낼 ISO 문자열로 만든다.
 *
 * `now = new Date()` 를 기본값 매개변수로 둔 것이 요령이다.
 * 평소에는 생략하고 쓰지만, 테스트에서는 고정된 시각을 넣어
 * 결과가 항상 같게 만들 수 있다. (시간에 의존하는 함수를 테스트하는 표준 방법)
 */
export const createRelativeEndsAt = (minutes: number, now = new Date()): string =>
  new Date(now.getTime() + minutes * 60_000).toISOString();

/**
 * 사용자가 직접 고른 날짜·시간을 서버 형식으로 바꾼다.
 *
 * ★ 잘못된 값이면 오류를 던지지 않고 undefined 를 돌려준다.
 *   입력 도중의 불완전한 값에도 함수가 계속 호출되므로,
 *   오류를 던지면 타이핑하는 내내 예외가 발생한다.
 *   "아직 유효하지 않음"을 undefined 로 표현하는 편이 다루기 쉽다.
 *
 * Number.isNaN(date.getTime()) 은 Date 가 유효한지 확인하는 표준 방법이다.
 * `new Date("아무말")` 은 오류를 내지 않고 Invalid Date 를 만들기 때문이다.
 */
export const createAbsoluteEndsAt = (dateTimeLocalValue: string): string | undefined => {
  const parsedDate = new Date(dateTimeLocalValue);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toISOString();
};
