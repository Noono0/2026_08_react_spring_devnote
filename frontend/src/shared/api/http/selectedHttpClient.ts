/**
 * ============================================================================
 * selectedHttpClient.ts — 두 구현 중 실제로 쓸 하나를 고르는 "스위치"
 * ============================================================================
 *
 * [이 파일이 존재하는 이유]
 *   앱 전체에서 서버 통신은 이 파일이 내보내는 `selectedHttpClient` 하나만 쓴다.
 *   페이지도, 훅도, API 파일도 전부 이것만 import 한다.
 *   그래서 axios ↔ fetch를 바꾸려면 이 파일 한 줄만 고치면 되고,
 *   나머지 수십 개 파일은 손댈 필요가 없다.
 *
 *   이런 구조를 "의존성 주입(Dependency Injection)"이라고 부른다.
 *   말은 거창하지만 뜻은 단순하다:
 *   "쓰는 쪽이 구체적인 도구를 직접 고르지 않고, 밖에서 정해 준 걸 받아 쓴다."
 *
 * [연습해 보기]
 *   `.env.development` 파일에서 VITE_HTTP_CLIENT=fetch 로 바꾸고
 *   개발 서버를 다시 켜 보자. 화면은 똑같이 동작하지만
 *   개발자도구 Network 탭에서 요청을 보내는 주체가 바뀐 걸 확인할 수 있다.
 */

// `import type`은 "타입으로만 쓰고, 실제 값은 안 가져온다"는 뜻이다.
// 이렇게 적으면 빌드 결과물에서 이 import가 완전히 사라져 파일 크기가 줄어든다.
import type { HttpClient } from "./HttpClient";
import { axiosHttpClient } from "./AxiosHttpClient";
import { fetchHttpClient } from "./FetchHttpClient";
import { applicationEnvironment } from "@/shared/config/applicationEnvironment";

/**
 * 기본값은 Axios입니다. .env.development의 VITE_HTTP_CLIENT를 fetch로 바꾸면
 * Page, Hook, API Service 코드를 수정하지 않고 Fetch 구현으로 전환됩니다.
 *
 * 주석 전환 연습을 하려면 아래 삼항 연산자를 주석 처리하고 원하는 한 줄만 남겨도 됩니다.
 */
// `: HttpClient` 라고 타입을 못 박은 게 핵심이다.
// 이러면 두 구현 중 무엇이 들어오든 쓰는 쪽에서는 똑같은 다섯 개 메서드만 보인다.
// 혹시 한쪽 구현에 메서드가 빠져 있으면 이 줄에서 바로 타입 에러가 난다.
// 즉 "약속을 안 지킨 구현"을 컴파일 단계에서 걸러 준다.
export const selectedHttpClient: HttpClient =
  applicationEnvironment.VITE_HTTP_CLIENT === "fetch" ? fetchHttpClient : axiosHttpClient;

// 아래 두 줄은 "환경변수 신경 쓰지 말고 하나로 고정해서 실험해 보고 싶을 때" 쓰라고 남겨 둔 것이다.
// 위 줄을 주석 처리하고 아래 중 하나만 주석 해제하면 된다.
// export const selectedHttpClient: HttpClient = axiosHttpClient;
// export const selectedHttpClient: HttpClient = fetchHttpClient;
