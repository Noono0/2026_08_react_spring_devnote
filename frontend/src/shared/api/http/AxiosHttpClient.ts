/**
 * ============================================================================
 * AxiosHttpClient.ts — axios 라이브러리로 만든 HTTP 통신 구현체
 * ============================================================================
 *
 * HttpClient.ts에서 정한 다섯 가지 약속(get/post/put/delete/upload)을
 * axios를 써서 실제로 구현한 파일이다.
 *
 * [이 파일에서 배울 개념]
 *   1. class와 인스턴스 — 지금까지 본 함수형 코드와 다른 스타일
 *   2. 인터셉터(interceptor) — 모든 요청/응답이 반드시 거쳐 가는 검문소
 *   3. 왜 통신 코드를 한 곳에 모아 두면 좋은가
 *
 * [React 컴포넌트와 무관한 파일이다]
 *   여기에는 JSX도 훅도 없다. 순수한 TypeScript 로직이다.
 *   화면(React)과 통신(여기)을 분리해 두면 각각 따로 테스트하고 교체할 수 있다.
 */

import axios, { type AxiosInstance } from "axios";
import type { FileUploadOptions, HttpClient, HttpRequestOptions } from "./HttpClient";
import { createCommonRequestHeaders } from "./requestHelpers";
import { applicationEnvironment } from "@/shared/config/applicationEnvironment";
import { applicationLogger } from "@/shared/logging/applicationLogger";

// 10초 안에 응답이 안 오면 포기하고 에러 처리한다.
//
// ★ 타임아웃이 없으면 어떻게 되나?
//   서버가 멈춰 있을 때 로딩 스피너가 영원히 돌면서 사용자는 하염없이 기다린다.
//   차라리 10초 뒤에 "연결 실패"라고 알려주는 게 훨씬 낫다.
//
// 이렇게 숫자를 상수(대문자 이름)로 빼 두면
// 값의 의미가 이름으로 설명되고, 나중에 한 곳만 고치면 된다.
// 코드 중간에 그냥 10000이라고 박혀 있으면 "이 숫자가 뭐지?" 하게 된다. (매직 넘버)
const REQUEST_TIMEOUT_MILLISECONDS = 10_000;

/**
 * `class`는 "데이터와 그걸 다루는 함수들을 하나로 묶은 틀"이다.
 *
 * `implements HttpClient` = "나는 HttpClient가 정한 약속을 전부 지키겠다"는 선언.
 * 만약 메서드 하나를 빠뜨리거나 타입을 틀리게 쓰면 TypeScript가 바로 알려 준다.
 * 인터페이스의 가장 큰 장점이 바로 이 "약속 위반 자동 감지"다.
 */
export class AxiosHttpClient implements HttpClient {
  // private  → 이 클래스 안에서만 쓸 수 있다. 바깥에서 접근하면 에러.
  // readonly → 처음 한 번만 값을 넣을 수 있고 나중에 바꿀 수 없다.
  //
  // 왜 이렇게 잠가 두나?
  //   외부에서 axiosInstance를 마음대로 바꾸면 아래 인터셉터 설정이 무력화된다.
  //   "밖에서 건드리면 안 되는 것"은 처음부터 못 건드리게 막아 두는 게 안전하다.
  private readonly axiosInstance: AxiosInstance;

  // constructor(생성자): `new AxiosHttpClient()` 할 때 딱 한 번 실행되는 준비 함수.
  constructor() {
    // axios.create(): 공통 설정이 미리 박힌 "나만의 axios"를 만든다.
    //
    // 이걸 안 만들고 매번 axios.get("http://localhost:8080/api/documents") 처럼 쓰면
    // 주소와 설정을 모든 호출마다 반복해야 한다.
    this.axiosInstance = axios.create({
      // baseURL: 모든 요청 주소 앞에 자동으로 붙는 부분.
      //   이게 있으면 앞으로 get("/documents") 만 써도 되고,
      //   서버 주소가 바뀌어도 .env 파일 한 줄만 고치면 된다.
      baseURL: applicationEnvironment.VITE_API_BASE_URL,
      timeout: REQUEST_TIMEOUT_MILLISECONDS,
      // withCredentials: 쿠키를 요청에 함께 실어 보낸다.
      // 로그인 세션 쿠키를 유지하려면 필요하다. (기본값은 false라 안 보낸다)
      withCredentials: true,
    });

    // ── 요청 인터셉터 ────────────────────────────────────────────────
    // "요청이 서버로 나가기 직전에 반드시 들르는 검문소".
    //
    // ★ 이게 왜 강력한가?
    //   모든 API 호출마다 헤더를 붙이고 로그를 찍는 코드를 쓴다고 생각해 보자.
    //   수십 곳에 같은 코드가 복붙되고, 한 군데만 빠뜨려도 버그가 된다.
    //   인터셉터에 한 번 등록하면 모든 요청에 자동으로 적용된다.
    this.axiosInstance.interceptors.request.use((requestConfiguration) => {
      // 공통 헤더(요청 ID, 회원 ID)를 만들어서 하나씩 붙인다.
      const commonRequestHeaders = createCommonRequestHeaders();
      Object.entries(commonRequestHeaders).forEach(([headerName, headerValue]) => {
        requestConfiguration.headers.set(headerName, headerValue);
      });

      // 개발자도구 콘솔에 "어떤 요청이 나갔는지" 남긴다.
      // `?.` 를 쓴 이유: method가 없을 수도 있다고 타입에 적혀 있어서다.
      // 그냥 .toUpperCase()를 부르면 undefined일 때 에러가 난다.
      applicationLogger.info("[AxiosHttpClient] 요청 시작", {
        requestMethod: requestConfiguration.method?.toUpperCase(),
        requestUrl: requestConfiguration.url,
      });

      // ★ 반드시 설정 객체를 return 해야 한다!
      //   이걸 빠뜨리면 axios가 "보낼 설정이 없다"고 판단해서
      //   모든 요청이 조용히 멈춰 버린다. 초보자가 자주 겪는 함정이다.
      return requestConfiguration;
    });

    // ── 응답 인터셉터 ────────────────────────────────────────────────
    // 서버 응답이 우리 코드에 도착하기 직전에 들르는 검문소.
    // 함수를 두 개 넘기는데, 첫 번째는 성공용, 두 번째는 실패용이다.
    this.axiosInstance.interceptors.response.use(
      // [성공했을 때]
      (response) => {
        applicationLogger.info("[AxiosHttpClient] 응답 성공", {
          requestUrl: response.config.url,
          responseStatus: response.status,
        });
        // 여기서도 return을 빠뜨리면 응답이 사라진다.
        return response;
      },
      // [실패했을 때]
      // 타입이 `unknown`인 이유:
      //   JavaScript에서는 throw로 아무 값이나 던질 수 있다.
      //   Error 객체일 수도, 그냥 문자열일 수도, 숫자일 수도 있다.
      //   그래서 "무엇인지 모른다(unknown)"고 두고, 쓰기 전에 확인하도록 강제한다.
      //   any로 두면 편하지만 타입 검사가 통째로 꺼져서 위험하다.
      (requestError: unknown) => {
        applicationLogger.error("[AxiosHttpClient] 응답 실패", requestError);

        // ★ Promise.reject(...)로 에러를 "다시 던지는" 것이 핵심이다.
        //   여기서 그냥 return 해 버리면 호출한 쪽은 성공한 줄 알게 된다.
        //   화면에는 아무 데이터도 없는데 에러 표시도 안 되는 최악의 상황이 된다.
        //   로그만 남기고 에러는 그대로 위로 흘려보내야 한다.
        return Promise.reject(
          // 에러가 Error 객체가 아니면 Error로 감싼다.
          // `cause`에 원본을 넣어 두면 나중에 원인을 추적할 수 있다.
          requestError instanceof Error
            ? requestError
            : new Error("HTTP 요청 처리에 실패했습니다.", { cause: requestError }),
        );
      },
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // 아래 다섯 메서드는 구조가 거의 똑같다. 하나만 이해하면 나머지는 같다.
  //   1) axios로 요청을 보내고 await로 기다린다
  //   2) 응답에서 알맹이(response.data)만 꺼내서 돌려준다
  // ──────────────────────────────────────────────────────────────────

  async get<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    const response = await this.axiosInstance.get<ResponseData>(requestUrl, {
      // params: axios가 알아서 `?key=value` 형태로 만들어 붙여 준다.
      params: requestOptions?.queryParameters,
      headers: requestOptions?.requestHeaders,
      // signal: 요청 취소 신호. axios는 `signal`이라는 이름으로 받는다.
      signal: requestOptions?.abortSignal,
    });

    // ★ `response.data`를 반환하는 것에 주목.
    //   axios의 response에는 status, headers, config 등 부가 정보가 잔뜩 들어 있다.
    //   그런데 페이지 코드에서 필요한 건 알맹이뿐이다.
    //   여기서 미리 벗겨 주면 쓰는 쪽 코드가 훨씬 깔끔해진다.
    //
    //   벗기지 않으면:  const res = await client.get(...); setDocs(res.data.data);
    //   벗기면:        const docs = await client.get(...);
    //
    //   또한 fetch 구현도 똑같이 알맹이만 돌려주므로,
    //   둘을 바꿔 껴도 쓰는 쪽 코드가 그대로다.
    return response.data;
  }

  async post<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    // post/put은 get과 달리 두 번째 자리에 "보낼 데이터"가 들어간다.
    // axios가 객체를 자동으로 JSON 문자열로 바꾸고
    // Content-Type: application/json 헤더까지 붙여 준다. (fetch는 이걸 직접 해야 한다)
    const response = await this.axiosInstance.post<ResponseData>(requestUrl, requestData, {
      headers: requestOptions?.requestHeaders,
      signal: requestOptions?.abortSignal,
    });
    return response.data;
  }

  async put<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    const response = await this.axiosInstance.put<ResponseData>(requestUrl, requestData, {
      headers: requestOptions?.requestHeaders,
      signal: requestOptions?.abortSignal,
    });
    return response.data;
  }

  async delete<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    const response = await this.axiosInstance.delete<ResponseData>(requestUrl, {
      params: requestOptions?.queryParameters,
      headers: requestOptions?.requestHeaders,
      signal: requestOptions?.abortSignal,
    });
    return response.data;
  }

  async upload<ResponseData>(
    requestUrl: string,
    formData: FormData,
    uploadOptions?: FileUploadOptions,
  ): Promise<ResponseData> {
    // 파일 업로드도 결국 POST 요청이다. 다만 본문이 JSON이 아니라 FormData다.
    //
    // ★ Content-Type을 일부러 안 적은 게 포인트다.
    //   FormData를 보낼 때는 "multipart/form-data; boundary=----xyz123..." 처럼
    //   구분자(boundary)가 붙은 복잡한 헤더가 필요한데, 이걸 사람이 직접 쓰면 거의 틀린다.
    //   비워 두면 브라우저가 정확하게 만들어 준다. 손대지 않는 게 정답이다.
    const response = await this.axiosInstance.post<ResponseData>(requestUrl, formData, {
      headers: uploadOptions?.requestHeaders,
      signal: uploadOptions?.abortSignal,

      // onUploadProgress: 업로드가 진행되는 동안 axios가 계속 불러 주는 함수.
      // 여기서 퍼센트를 계산해 화면 쪽 콜백에 넘겨 주면 진행률 바를 그릴 수 있다.
      onUploadProgress: (uploadProgressEvent) => {
        // 두 가지를 먼저 확인하고 아니면 그냥 나간다.
        //   1) total이 없을 수 있다 — 서버가 전체 크기를 안 알려주면 %를 계산할 수 없다
        //   2) 진행률 콜백을 안 넘겼을 수도 있다 — 그러면 계산해 봐야 쓸 데가 없다
        // 이렇게 "안 되는 경우를 먼저 걸러내고 나가는" 방식을 early return이라고 한다.
        // if문을 겹겹이 중첩하는 것보다 훨씬 읽기 쉽다.
        if (!uploadProgressEvent.total || !uploadOptions?.handleUploadProgressChange) {
          return;
        }

        // (보낸 양 × 100) ÷ 전체 양 = 퍼센트.
        // Math.round로 반올림해서 소수점 없는 정수로 만든다. (33.333333% → 33%)
        //
        // 곱하기를 먼저 하는 이유: 나누기를 먼저 하면 0.333... 처럼
        // 소수가 되면서 미세한 오차가 생긴다. 정수 계산이 더 정확하다.
        const percentage = Math.round(
          (uploadProgressEvent.loaded * 100) / uploadProgressEvent.total,
        );

        // 화면 쪽이 넘겨준 함수를 호출한다.
        // 위 if에서 존재를 확인했으므로 여기서는 `?.` 없이 안전하게 부를 수 있다.
        uploadOptions.handleUploadProgressChange(percentage);
      },
    });
    return response.data;
  }
}

// ★ 여기서 딱 한 번만 인스턴스를 만들고, 앱 전체가 이 하나를 공유한다.
//   이런 패턴을 싱글턴(singleton)이라고 부른다.
//
//   왜 하나만 만드나?
//     - axios 인스턴스 생성과 인터셉터 등록은 매번 할 필요가 없는 준비 작업이다
//     - 여러 개를 만들면 설정이 서로 달라져 "왜 얘만 헤더가 없지?" 같은 혼란이 생긴다
//
//   클래스도 export한 이유: 테스트에서 설정을 바꿔 새 인스턴스를 만들 수 있게 하기 위해서다.
export const axiosHttpClient = new AxiosHttpClient();
