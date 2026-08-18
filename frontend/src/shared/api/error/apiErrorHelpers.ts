/**
 * ============================================================================
 * apiErrorHelpers.ts — 제각각인 에러를 하나의 표준 모양으로 정리해 주는 곳
 * ============================================================================
 *
 * [이 파일이 필요한 이유]
 *   API 호출이 실패하는 방식은 놀랄 만큼 다양하다.
 *     - 서버가 404를 보냈다              → axios 에러 객체
 *     - 서버가 아예 안 켜져 있다          → 네트워크 에러
 *     - 사용자가 페이지를 떠나 취소됐다    → 취소 에러 (사실 오류가 아니다!)
 *     - 인터넷이 끊겼다                  → TypeError
 *     - 알 수 없는 무언가                → 정체불명
 *
 *   이걸 화면마다 전부 구분해서 처리하려고 하면 if문 지옥이 된다.
 *   그래서 "무엇이 들어오든 ApiProblemDetails 하나로 바꿔 주는" 변환기를 만든 것이다.
 *
 *   화면 코드는 그냥 이렇게만 쓰면 된다:
 *     const problem = convertRequestErrorToProblemDetails(error);
 *     alert(problem.detail);
 *
 * [배울 개념]
 *   - 다양한 에러 타입을 구분하는 방법 (instanceof, 타입 가드)
 *   - unknown 타입을 안전하게 좁혀 나가기
 */

import axios from "axios";
import type { ApiProblemDetails } from "./apiErrorTypes";

// 어떤 방법으로도 정체를 알 수 없을 때 쓰는 최후의 기본값.
// 이런 게 없으면 함수가 undefined를 돌려줄 수 있고, 화면이 빈 오류 메시지를 띄우게 된다.
const defaultProblemDetails: ApiProblemDetails = {
  status: 0,
  errorCode: "UNKNOWN_CLIENT_ERROR",
  detail: "알 수 없는 오류가 발생했습니다.",
  fieldErrors: [],
};

/**
 * 정체불명의 에러를 표준 오류 객체로 변환한다.
 *
 * ★ 검사 순서가 매우 중요하다.
 *   위에서부터 "가장 구체적으로 알 수 있는 것"부터 확인하고,
 *   아래로 갈수록 점점 모호한 경우를 처리한다.
 *   순서를 뒤집으면 넓은 조건이 먼저 걸려서 정확한 판단을 놓친다.
 */
export const convertRequestErrorToProblemDetails = (requestError: unknown): ApiProblemDetails => {
  // ── 1단계: 취소된 요청인가? ────────────────────────────────────
  // ★ 이걸 가장 먼저 확인하는 이유가 있다.
  //   요청 취소는 "오류"가 아니라 "정상적인 흐름"이다.
  //   검색어를 계속 타이핑하면 이전 요청을 일부러 취소하고,
  //   페이지를 떠나면 진행 중인 요청을 정리한다. 둘 다 의도한 동작이다.
  //   이걸 오류로 취급하면 사용자에게 빨간 알림이 마구 뜬다.
  if (axios.isCancel(requestError)) {
    return {
      // status: 0 = "서버에 도달하지도 못했다"는 뜻으로 이 프로젝트가 쓰는 약속이다.
      status: 0,
      errorCode: "REQUEST_CANCELLED",
      detail: "이전 요청이 취소되었습니다.",
      fieldErrors: [],
    };
  }

  // ── 2단계: axios가 만든 에러인가? ──────────────────────────────
  // isAxiosError<T>(...)는 "타입 가드"다.
  // 이 if 블록 안에서는 TypeScript가 requestError를 axios 에러로 확정해 주므로
  // requestError.response 같은 속성에 안전하게 접근할 수 있다.
  if (axios.isAxiosError<ApiProblemDetails>(requestError)) {
    // 2-1) 서버가 응답을 보냈다 = 서버까지 잘 도착했고, 서버가 오류라고 답한 것.
    //      우리 백엔드는 오류도 ApiProblemDetails 모양으로 보내므로 그대로 쓰면 된다.
    if (requestError.response?.data) {
      return requestError.response.data;
    }

    // 2-2) axios 에러인데 응답이 없다 = 서버에 닿지 못했다.
    //      서버가 꺼져 있거나, 주소가 틀렸거나, CORS에 막혔거나, 타임아웃됐다.
    return {
      status: 0,
      errorCode: "NETWORK_CONNECTION_FAILED",
      detail: "백엔드 서버에 연결할 수 없습니다.",
      fieldErrors: [],
    };
  }

  // ── 3단계: fetch로 보낸 요청이 취소된 경우 ─────────────────────
  // axios는 취소를 axios.isCancel로 잡지만, 브라우저 기본 fetch는
  // name이 "AbortError"인 DOMException을 던진다.
  // 이 프로젝트는 axios/fetch 두 구현을 모두 지원하므로 양쪽 다 처리해야 한다.
  //
  // `instanceof`: "이 값이 저 클래스로 만들어진 것인가?"를 확인하는 연산자.
  if (requestError instanceof DOMException && requestError.name === "AbortError") {
    return {
      status: 0,
      errorCode: "REQUEST_CANCELLED",
      detail: "이전 요청이 취소되었습니다.",
      fieldErrors: [],
    };
  }

  // ── 4단계: fetch의 네트워크 실패 ───────────────────────────────
  // 브라우저 fetch는 인터넷이 끊기거나 서버에 닿지 못하면
  // 뜬금없이 TypeError를 던진다. (헷갈리지만 명세가 그렇다)
  if (requestError instanceof TypeError) {
    return {
      status: 0,
      errorCode: "NETWORK_CONNECTION_FAILED",
      detail: "백엔드 서버에 연결할 수 없습니다.",
      fieldErrors: [],
    };
  }

  // ── 5단계: Error로 감싸인 안쪽에 진짜 정보가 있는 경우 ────────
  // AxiosHttpClient의 응답 인터셉터에서 `new Error(메시지, { cause: 원본 })`으로
  // 감싼 걸 기억하는가? 그 `cause` 안에 진짜 오류 정보가 들어 있을 수 있다.
  // 포장지를 벗겨서 안을 확인하는 단계다.
  if (requestError instanceof Error && isApiProblemDetails(requestError.cause)) {
    return requestError.cause;
  }

  // ── 6단계: 이미 우리 표준 모양인 경우 ─────────────────────────
  // 감싸지 않고 그대로 던져진 경우다. 검사만 하고 그대로 돌려준다.
  if (isApiProblemDetails(requestError)) {
    return requestError;
  }

  // ── 마지막: 전부 아니면 기본값 ────────────────────────────────
  // 함수가 어떤 경우에도 반드시 값을 돌려주도록 보장하는 안전망이다.
  return defaultProblemDetails;
};

/**
 * "이 오류는 다시 시도해 볼 가치가 있는가?"를 판단한다.
 * ApplicationProviders.tsx의 TanStack Query 재시도 설정이 이 함수를 쓴다.
 */
export const isApiErrorRetryable = (requestError: unknown): boolean => {
  // 먼저 표준 모양으로 정리한다. 그래야 아래에서 일관되게 판단할 수 있다.
  const problemDetails = convertRequestErrorToProblemDetails(requestError);

  // 취소된 요청은 절대 재시도하면 안 된다.
  // 일부러 취소한 걸 다시 보내면 취소한 의미가 없다. (무한 반복이 될 수도 있다)
  if (problemDetails.errorCode === "REQUEST_CANCELLED") {
    return false;
  }

  // 재시도할 가치가 있는 경우는 두 가지다.
  //   status === 0        → 네트워크 문제. 잠깐 뒤에 되살아날 수 있다.
  //   502, 503, 504       → 서버가 일시적으로 힘들어하는 상태.
  //                         (Bad Gateway / Service Unavailable / Gateway Timeout)
  //
  // 반대로 재시도하면 안 되는 것들:
  //   400 입력이 틀렸다     → 같은 걸 또 보내면 또 틀린다
  //   401 로그인이 필요하다 → 로그인부터 해야 한다
  //   403 권한이 없다      → 백 번 보내도 권한은 안 생긴다
  //   404 없는 자원이다     → 갑자기 생겨나지 않는다
  //   500 서버 코드 버그    → 고치기 전엔 계속 실패한다
  return problemDetails.status === 0 || [502, 503, 504].includes(problemDetails.status);
};

/**
 * 정체불명의 값이 우리 표준 오류 모양인지 확인한다.
 *
 * ★ 반환 타입이 `boolean`이 아니라 `value is ApiProblemDetails`인 점이 핵심이다.
 *   이걸 "타입 가드(type guard)"라고 부른다.
 *   보통 함수라면 true/false만 알려주고 끝이지만,
 *   이렇게 쓰면 TypeScript가 이렇게 알아듣는다:
 *     "이 함수가 true를 돌려줬다면, 그 값은 ApiProblemDetails가 맞다."
 *
 *   그래서 호출하는 쪽에서 if로 감싸기만 하면
 *   그 안에서는 타입 단언(as) 없이도 안전하게 속성에 접근할 수 있다.
 */
const isApiProblemDetails = (value: unknown): value is ApiProblemDetails => {
  // 객체가 아니면 볼 것도 없다.
  //
  // ★ `value === null`을 따로 확인하는 이유
  //   JavaScript의 유명한 버그로, typeof null 의 결과가 "object"다.
  //   그래서 typeof 검사만 하면 null이 통과해 버리고,
  //   아래에서 null.errorCode를 읽다가 앱이 죽는다.
  if (typeof value !== "object" || value === null) {
    return false;
  }

  // Partial<T> = "T의 모든 속성이 있어도 되고 없어도 되는" 타입.
  // 아직 진짜 ApiProblemDetails인지 모르는 상태이므로
  // "다 없을 수도 있다"고 가정하고 조심스럽게 들여다보는 것이다.
  const candidate = value as Partial<ApiProblemDetails>;

  // 필수 속성 두 개가 제 타입으로 들어 있으면 우리 오류 객체로 인정한다.
  // 모든 속성을 다 검사할 수도 있지만, 실무에서는 이렇게
  // "핵심 몇 개만 확인하는" 정도가 비용 대비 효과가 좋다.
  return typeof candidate.errorCode === "string" && typeof candidate.status === "number";
};
