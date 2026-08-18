/**
 * ============================================================================
 * applicationLogger.ts — console.log 대신 쓰는 로그 도구
 * ============================================================================
 *
 * [왜 console.log를 직접 쓰지 않나?]
 *   개발할 때 여기저기 console.log를 뿌려 두면 편하다.
 *   그런데 그대로 배포하면 이런 문제가 생긴다.
 *     - 사용자가 F12를 눌렀을 때 개발 로그가 그대로 보인다 (없어 보인다)
 *     - 로그에 회원 ID나 내부 구조 같은 정보가 노출될 수 있다
 *     - 로그가 너무 많으면 성능에도 영향을 준다
 *
 *   그렇다고 배포 전에 console.log를 일일이 지우는 건 현실적이지 않다.
 *   그래서 "가운데 창구"를 하나 만들어 두고 모두 그걸 통해 로그를 남긴다.
 *   그러면 개발/운영 구분을 이 파일 한 곳에서 제어할 수 있다.
 *
 * [로그 단계(level)를 나누는 이유]
 *   debug → 상세한 추적용. 평소엔 시끄럽다.
 *   info  → 정상 흐름 기록. "요청 시작", "응답 성공" 등.
 *   warn  → 문제는 아닌데 좀 이상한 것.
 *   error → 진짜 문제. 반드시 봐야 하는 것.
 *
 * [class를 안 쓰고 객체로 만든 이유]
 *   AxiosHttpClient는 인스턴스마다 다른 설정(axios 객체)을 가져야 해서 class를 썼다.
 *   이 로거는 보관할 상태가 없고 함수 몇 개만 있으면 된다.
 *   이럴 때는 그냥 객체 하나로 충분하다. 더 간단하고 읽기 쉽다.
 */

// import.meta.env.DEV 는 Vite가 넣어 주는 값이다.
//   `npm run dev`   → true
//   `npm run build` → false
//
// 파일 최상단에서 한 번만 읽어 상수로 저장한다.
// 앱이 도는 중에 이 값이 바뀔 일은 없으므로 매번 확인할 필요가 없다.
const isDevelopmentEnvironment = import.meta.env.DEV;

export const applicationLogger = {
  /**
   * 상세 추적용 로그. 개발 중에만 출력된다.
   *
   * `details?: unknown` 에서
   *   `?`       → 안 넘겨도 된다
   *   `unknown` → 아무 값이나 받을 수 있다. 객체든 문자열이든 배열이든.
   *               any와 달리 "쓰기 전에 확인하라"고 강제하지만,
   *               여기서는 console에 그냥 넘기기만 하므로 확인이 필요 없다.
   */
  debug(message: string, details?: unknown): void {
    if (isDevelopmentEnvironment) {
      // `details ?? ""` 의 이유:
      //   details를 안 넘기면 undefined인데, 그대로 넘기면
      //   콘솔에 "[Api] 요청 시작 undefined" 처럼 지저분하게 찍힌다.
      //   빈 문자열로 바꾸면 깔끔하게 메시지만 보인다.
      console.debug(message, details ?? "");
    }
  },

  /** 정상 흐름 기록. 개발 중에만 출력된다. */
  info(message: string, details?: unknown): void {
    if (isDevelopmentEnvironment) {
      console.info(message, details ?? "");
    }
  },

  /** 주의가 필요한 상황. 개발 중에만 출력된다. */
  warn(message: string, details?: unknown): void {
    if (isDevelopmentEnvironment) {
      console.warn(message, details ?? "");
    }
  },

  /**
   * 오류 기록.
   *
   * ★ 이 함수만 `if (isDevelopmentEnvironment)` 검사가 없다. 의도적이다.
   *   오류는 배포 환경에서도 반드시 남겨야 한다.
   *   사용자가 "화면이 안 떠요"라고 신고했을 때
   *   콘솔에 아무것도 없으면 원인을 짐작조차 할 수 없다.
   *
   *   실무에서는 여기에 Sentry 같은 오류 수집 서비스를 연결해서
   *   사용자 화면에서 난 오류를 개발자가 자동으로 받아 보게 만든다.
   *   그런 확장을 이 한 곳에서만 하면 된다는 게 로거를 따로 둔 진짜 이득이다.
   */
  error(message: string, details?: unknown): void {
    console.error(message, details ?? "");
  },
};
