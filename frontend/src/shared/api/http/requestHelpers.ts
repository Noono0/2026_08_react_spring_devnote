/**
 * ============================================================================
 * requestHelpers.ts — Axios/Fetch 두 구현이 함께 쓰는 요청 준비 도우미
 * ============================================================================
 *
 * AxiosHttpClient와 FetchHttpClient는 통신 방식은 다르지만
 * "공통 헤더 만들기", "주소에 쿼리 붙이기"는 똑같이 필요하다.
 * 같은 코드를 두 번 쓰지 않으려고 여기 모아 뒀다.
 *
 * ★ 중복 제거의 진짜 이유는 "타이핑을 줄이는 것"이 아니다.
 *   규칙이 바뀔 때 한 군데만 고치면 되고, 두 구현이 서로 어긋날 일이 없어서다.
 */

import { applicationEnvironment } from "@/shared/config/applicationEnvironment";
import { createUuid } from "@/shared/lib/createUuid";

/**
 * 요청마다 붙일 고유 ID를 만든다.
 *
 * createUuid(): 브라우저가 제공하는 진짜 랜덤 ID 생성기.
 *   결과 예: "3f2a1b4c-9d8e-4f7a-b6c5-1e2d3c4b5a69"
 *
 * .replaceAll("-", ""): 하이픈을 전부 없애 32글자로 만든다.
 *   서버 로그 시스템이 하이픈 없는 형식을 기대해서다.
 *
 * ★ Math.random()으로 만들면 안 되나?
 *   되긴 하지만 값이 겹칠 확률이 있고, 예측도 가능하다.
 *   브라우저가 공짜로 제대로 된 걸 주는데 굳이 직접 만들 이유가 없다.
 */
export const createRequestId = (): string => createUuid().replaceAll("-", "");

/**
 * 모든 요청에 공통으로 붙일 헤더를 만든다.
 *
 * [헤더가 뭔가요?]
 *   요청 본문(진짜 데이터)과 별개로 딸려 가는 "쪽지"들이다.
 *   "나는 누구다", "이 데이터는 JSON이다" 같은 부가 정보를 담는다.
 *   택배로 치면 상자 안의 물건이 본문, 겉에 붙은 송장이 헤더다.
 */
export const createCommonRequestHeaders = (
  additionalHeaders?: Record<string, string>,
): Record<string, string> => ({
  // ↑ 화살표 함수가 `=> ({...})` 처럼 소괄호로 감싸진 것에 주목.
  //   `=> {...}` 라고 쓰면 JavaScript가 중괄호를 "함수 본문"으로 오해한다.
  //   "이건 객체다"라고 알려주려면 반드시 소괄호로 한 번 더 감싸야 한다.

  // 요청 추적용 ID. 서버 로그에서 이 값으로 검색하면 해당 요청의 흐름을 다 볼 수 있다.
  "X-Request-Id": createRequestId(),

  // 학습용 임시 로그인 정보. 실무의 진짜 인증(JWT 토큰 등)을 대신하는 간이 방식이다.
  //
  // `??` = null 병합 연산자(nullish coalescing).
  //   "왼쪽이 null이나 undefined면 오른쪽을 쓴다"는 뜻.
  //
  // ★ `||` 와 헷갈리기 쉬운데 결정적인 차이가 있다.
  //   `||` 는 빈 문자열 ""이나 숫자 0도 "없는 것"으로 쳐서 오른쪽을 쓴다.
  //   `??` 는 오직 null/undefined일 때만 오른쪽을 쓴다.
  //   "0" 같은 유효한 값을 실수로 날려버리지 않으려면 `??` 가 안전하다.
  "X-Member-Id": localStorage.getItem("developmentMemberId") ??
    applicationEnvironment.VITE_DEVELOPMENT_MEMBER_ID,

  // `...` = 전개 연산자(spread). 객체의 내용을 이 자리에 펼쳐 넣는다.
  //
  // ★ 위치가 중요하다!
  //   맨 아래에 뒀기 때문에, 같은 이름의 헤더가 있으면 additionalHeaders 쪽이 이긴다.
  //   즉 "기본값을 깔아 두고, 호출하는 쪽이 원하면 덮어쓸 수 있게" 한 것이다.
  //   반대로 맨 위에 뒀다면 위의 두 헤더가 항상 이겨서 덮어쓸 수 없게 된다.
  ...additionalHeaders,
});

/**
 * 주소 뒤에 `?key=value&key2=value2` 형태의 쿼리스트링을 붙인다.
 *
 *   appendQueryParameters("/api/documents", { page: 1, keyword: "리액트" })
 *   → "http://localhost:5173/api/documents?page=1&keyword=%EB%A6%AC%EC%95%A1%ED%8A%B8"
 *
 * ★ 왜 직접 문자열을 이어 붙이지 않을까?
 *   `url + "?keyword=" + keyword` 이렇게 하면
 *     - 한글이나 공백이 들어가면 주소가 깨진다
 *     - 값에 `&`가 들어 있으면 파라미터가 쪼개져 버린다
 *   URL 객체를 쓰면 이런 처리를 브라우저가 알아서 정확하게 해 준다.
 */
export const appendQueryParameters = (
  requestUrl: string,
  queryParameters?: object,
): string => {
  // new URL(주소, 기준주소)
  //   두 번째 인자가 필요한 이유: "/api/documents" 처럼 앞부분이 없는 주소는
  //   그 자체로는 완전한 URL이 아니라서 URL 객체를 만들 수 없다.
  //   window.location.origin("http://localhost:5173")을 앞에 붙여 완전하게 만든다.
  const requestUrlObject = new URL(requestUrl, window.location.origin);

  if (queryParameters) {
    // Object.entries({ a: 1, b: 2 })  →  [["a", 1], ["b", 2]]
    // 객체를 [키, 값] 쌍의 배열로 바꿔서 반복문을 돌 수 있게 만든다.
    // `([parameterName, parameterValue])` 부분은 그 쌍을 두 변수로 나눠 받는 구조 분해다.
    Object.entries(queryParameters).forEach(([parameterName, parameterValue]) => {
      // 값이 비어 있으면 아예 안 붙인다.
      //
      // ★ 왜 걸러내나?
      //   "?keyword=&page=1" 처럼 빈 값이 붙으면 서버가 "빈 문자열로 검색해 달라"는
      //   요청으로 오해할 수 있다. 아예 안 보내는 것과 의미가 달라진다.
      //
      // ★ 숫자 0과 false는 일부러 안 걸렀다.
      //   0은 "0페이지"라는 유효한 값이고 false도 유효한 선택이다.
      //   만약 `if (!parameterValue) return;` 이라고 짧게 썼다면
      //   0과 false까지 사라져서 찾기 어려운 버그가 됐을 것이다.
      if (parameterValue === undefined || parameterValue === null || parameterValue === "") {
        // forEach 안의 `return`은 함수 전체를 끝내는 게 아니라
        // "이번 항목만 건너뛴다"는 뜻이다. (반복문의 continue와 같다)
        return;
      }
      // searchParams.append: 특수문자를 자동으로 안전하게 변환해서 붙여 준다.
      // String(...)으로 감싸는 건 숫자나 boolean도 문자열로 바꿔 주기 위해서다.
      requestUrlObject.searchParams.append(parameterName, String(parameterValue));
    });
  }

  // URL 객체를 다시 문자열 주소로 되돌려 반환한다.
  return requestUrlObject.toString();
};
