/**
 * ============================================================================
 * applicationNotification.ts — 화면 구석에 뜨는 알림(토스트) 창구
 * ============================================================================
 *
 * [토스트(toast)란?]
 *   화면 모서리에 잠깐 나타났다 사라지는 알림 메시지다.
 *   빵 굽는 토스터에서 빵이 톡 튀어나오는 모습을 닮았다고 해서 붙은 이름이다.
 *
 * [왜 alert()를 쓰지 않나?]
 *   alert()는 확인 버튼을 누를 때까지 페이지 전체를 멈춰 버린다.
 *   "저장했습니다" 같은 가벼운 안내에 쓰기엔 너무 방해가 된다.
 *   토스트는 흐름을 끊지 않고 스스로 사라진다.
 *
 * [왜 sonner를 직접 안 쓰고 이 파일을 거치나?]
 *   applicationLogger와 완전히 같은 이유다. "가운데 창구"를 두는 것이다.
 *     - 나중에 다른 토스트 라이브러리로 바꿔도 이 파일만 고치면 된다
 *     - 알림 스타일이나 표시 시간을 한 곳에서 통일할 수 있다
 *     - apiError()처럼 이 프로젝트에만 필요한 기능을 추가할 수 있다
 *
 *   실제로 화면에 그려지는 자리는 ApplicationProviders.tsx의 <Toaster />다.
 *   이 파일은 "무엇을 띄울지"만 정하고, "어디에 어떻게 그릴지"는 Toaster가 한다.
 */

import { toast } from "sonner";
import type { ApiProblemDetails } from "@/shared/api/error/apiErrorTypes";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";

export const applicationNotification = {
  /** 성공 알림 (보통 초록색). "저장했습니다" 같은 경우. */
  success(title: string, description?: string): void {
    // { description } 은 { description: description } 의 줄임 표현이다.
    // 키와 변수 이름이 같으면 한 번만 써도 된다. (객체 속성 축약)
    toast.success(title, { description });
  },

  /** 실패 알림 (보통 빨간색). "저장하지 못했습니다" 같은 경우. */
  error(title: string, description?: string): void {
    toast.error(title, { description });
  },

  /** 경고 알림 (보통 노란색). "할 일을 입력해 주세요" 같은 입력 안내. */
  warning(title: string, description?: string): void {
    toast.warning(title, { description });
  },

  /**
   * API 오류 전용 알림.
   *
   * 위 세 개와 달리 문자열이 아니라 오류 객체를 통째로 받는다.
   * 그래서 호출하는 쪽은 이 한 줄이면 끝난다:
   *
   *   catch (error) {
   *     applicationNotification.apiError(convertRequestErrorToProblemDetails(error));
   *   }
   *
   * 어떤 문구를 보여줄지 고르는 복잡한 판단을 여기 한 곳에 모아 두면,
   * 화면마다 제각각으로 처리해서 어떤 데는 친절하고 어떤 데는 불친절한 일이 없어진다.
   */
  apiError(problemDetails: ApiProblemDetails): void {
    // ★ `??` 를 사슬처럼 이어서 3단계 우선순위를 표현했다.
    //   왼쪽부터 확인하다가 null/undefined가 아닌 첫 값에서 멈춘다.
    //
    //   1순위: 우리가 정한 사전의 한국어 문구
    //          (사전에 없는 코드면 undefined → 다음으로 넘어간다)
    //   2순위: 서버가 보낸 detail
    //          (오류 응답에 detail이 없을 수도 있다 → 다음으로)
    //   3순위: 최후의 기본 문구
    //          (이게 있어야 어떤 경우에도 빈 알림이 뜨지 않는다)
    const message =
      apiErrorMessageMap[problemDetails.errorCode] ??
      problemDetails.detail ??
      "요청을 처리하지 못했습니다.";

    toast.error(message, {
      // traceId가 있으면 작은 글씨로 함께 보여준다.
      // 사용자가 문의할 때 이 코드를 알려주면 개발자가 서버 로그에서
      // 그 요청 하나를 정확히 찾아낼 수 있다.
      //
      // `조건 ? 값 : undefined` 패턴:
      // undefined를 넘기면 sonner가 설명 줄 자체를 안 그린다.
      // 빈 문자열("")을 넘기면 빈 줄이 생겨서 어색해진다.
      description: problemDetails.traceId ? `문의 코드: ${problemDetails.traceId}` : undefined,
    });
  },
};
