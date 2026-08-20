/**
 * ============================================================================
 * FetchHttpClient.ts — 브라우저 기본 fetch로 만든 HTTP 통신 구현체
 * ============================================================================
 *
 * AxiosHttpClient와 똑같은 다섯 가지 약속을 지키지만, 도구가 다르다.
 * 두 파일을 나란히 놓고 비교하면 "라이브러리가 대신 해 주던 일"이 무엇인지 확 보인다.
 *
 * [axios가 자동으로 해 주던 것 → fetch에서는 직접 해야 하는 것]
 *   ┌──────────────────────┬─────────────┬──────────────────────────────┐
 *   │ 항목                  │ axios       │ fetch                        │
 *   ├──────────────────────┼─────────────┼──────────────────────────────┤
 *   │ baseURL 자동 결합      │ 설정만 하면 │ 매번 직접 이어 붙여야 함        │
 *   │ 객체 → JSON 변환      │ 자동         │ JSON.stringify() 직접 호출     │
 *   │ Content-Type 헤더     │ 자동         │ 직접 적어야 함                 │
 *   │ 응답 JSON 파싱        │ 자동         │ await response.json() 직접     │
 *   │ 4xx/5xx를 에러로 처리  │ 자동         │ response.ok를 보고 직접 throw │
 *   │ 인터셉터              │ 있음         │ 없음 → 공통 함수로 직접 구현    │
 *   │ 업로드 진행률          │ 지원         │ 지원 안 함 (아래 upload 참고)  │
 *   └──────────────────────┴─────────────┴──────────────────────────────┘
 *
 * [그럼 fetch는 나쁜 건가?]
 *   아니다. 설치할 라이브러리가 없어 앱 용량이 줄고, 모든 브라우저에 이미 들어 있다.
 *   기능이 단순한 프로젝트라면 fetch로 충분하다.
 *   중요한 건 "무엇을 쓰든 HttpClient 인터페이스 뒤에 숨겨 두면
 *   나중에 마음을 바꿔도 다른 코드는 영향을 안 받는다"는 점이다.
 *
 * ★ 가장 조심할 점: fetch는 404나 500 응답을 받아도 "실패"로 치지 않는다!
 *   서버에 요청이 닿아서 답을 받았으니 fetch 입장에서는 "성공"이다.
 *   그래서 response.ok를 직접 확인하고 에러를 던져야 한다. (아래 sendRequest 참고)
 *   이걸 모르고 try/catch만 쓰면 404가 조용히 통과해 버린다.
 */

import type { FileUploadOptions, HttpClient, HttpRequestOptions } from "./HttpClient";
import { appendQueryParameters, createCommonRequestHeaders } from "./requestHelpers";
import { applicationEnvironment } from "@/shared/config/applicationEnvironment";
import { applicationLogger } from "@/shared/logging/applicationLogger";

export class FetchHttpClient implements HttpClient {
  // GET: 조회. 보낼 본문이 없고, 조건은 주소 뒤 쿼리스트링으로 붙인다.
  async get<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    return this.sendRequest<ResponseData>(
      // ★ 주소를 직접 조립해야 한다. axios의 baseURL 같은 게 fetch에는 없다.
      //   백틱 템플릿 리터럴로 "서버주소 + 경로"를 이어 붙인 뒤,
      //   appendQueryParameters로 `?page=1&size=10` 같은 조건을 덧붙인다.
      appendQueryParameters(
        `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
        requestOptions?.queryParameters,
      ),
      {
        // fetch는 메서드를 문자열로 직접 적는다. (axios는 .get()처럼 함수가 나뉘어 있다)
        method: "GET",
        // 인터셉터가 없으므로 공통 헤더도 매 요청마다 직접 만들어 넣는다.
        // 이 반복을 그나마 줄이려고 requestHelpers.ts로 함수를 빼 둔 것이다.
        headers: createCommonRequestHeaders(requestOptions?.requestHeaders),
        signal: requestOptions?.abortSignal,
      },
    );
  }

  // POST: 생성. 보낼 데이터가 본문(body)에 실린다.
  async post<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    return this.sendRequest<ResponseData>(
      `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
      {
        method: "POST",
        headers: {
          // ★ Content-Type을 직접 적어야 한다.
          //   "내가 보내는 본문은 JSON 형식이다"라고 서버에 알리는 것이다.
          //   이걸 빠뜨리면 서버가 본문을 해석하지 못해 400 오류를 낸다.
          //   (axios는 객체를 넘기면 알아서 붙여 준다)
          "Content-Type": "application/json",
          ...createCommonRequestHeaders(requestOptions?.requestHeaders),
        },

        // ★ 객체를 JSON 문자열로 직접 바꿔야 한다.
        //   fetch의 body에는 문자열, FormData, Blob 같은 것만 넣을 수 있다.
        //   일반 객체를 그냥 넣으면 "[object Object]"라는 이상한 글자가 전송된다.
        //   초보자가 정말 자주 겪는 함정이다.
        //
        //   삼항 연산자로 undefined를 걸러 주는 이유:
        //   JSON.stringify(undefined)의 결과는 문자열 "undefined"가 아니라
        //   값 undefined인데, 이런 미묘한 경우를 아예 안 만들려고 미리 구분한다.
        body: requestData === undefined ? undefined : JSON.stringify(requestData),
        signal: requestOptions?.abortSignal,
      },
    );
  }

  // PUT: 수정. POST와 구조가 완전히 같고 method 문자열만 다르다.
  async put<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    return this.sendRequest<ResponseData>(
      `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...createCommonRequestHeaders(requestOptions?.requestHeaders),
        },
        body: requestData === undefined ? undefined : JSON.stringify(requestData),
        signal: requestOptions?.abortSignal,
      },
    );
  }

  // DELETE: 삭제. GET처럼 본문 없이 주소와 쿼리만 쓴다.
  async delete<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData> {
    return this.sendRequest<ResponseData>(
      appendQueryParameters(
        `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
        requestOptions?.queryParameters,
      ),
      {
        method: "DELETE",
        headers: createCommonRequestHeaders(requestOptions?.requestHeaders),
        signal: requestOptions?.abortSignal,
      },
    );
  }

  async upload<ResponseData>(
    requestUrl: string,
    formData: FormData,
    uploadOptions?: FileUploadOptions,
  ): Promise<ResponseData> {
    /*
     * fetch는 브라우저 표준 API만으로 업로드 진행률을 제공하지 않습니다.
     * Axios와 차이를 확인하기 위해 완료 시 100%만 전달합니다.
     */
    // ↑ 이게 두 구현의 가장 큰 기능 차이다.
    //   axios는 XMLHttpRequest 기반이라 업로드 중간중간 진행률을 알 수 있지만,
    //   fetch는 그런 기능이 아예 없다. 그래서 다 끝난 뒤 100%만 한 번 알려 준다.
    //   큰 파일 업로드에 진행률 바가 꼭 필요하다면 axios를 골라야 한다는 뜻이다.
    //   "라이브러리를 왜 쓰는가"에 대한 아주 현실적인 예시다.
    const response = await this.sendRequest<ResponseData>(
      `${applicationEnvironment.VITE_API_BASE_URL}${requestUrl}`,
      {
        method: "POST",
        // ★ 여기서는 Content-Type을 일부러 안 넣었다.
        //   FormData를 보낼 때는 브라우저가 boundary 값을 포함한 헤더를
        //   정확히 만들어 줘야 하는데, 우리가 적으면 그걸 덮어써서 업로드가 깨진다.
        headers: createCommonRequestHeaders(uploadOptions?.requestHeaders),
        // FormData는 JSON.stringify 하지 않고 그대로 넣는다. fetch가 이해할 수 있는 타입이다.
        body: formData,
        signal: uploadOptions?.abortSignal,
      },
    );

    // `?.` 가 두 번 연달아 나온 것에 주목.
    //   uploadOptions?.                    → 옵션 자체가 없을 수 있다
    //   handleUploadProgressChange?.(100)  → 콜백만 없을 수도 있다
    // 둘 중 하나라도 없으면 아무 일도 안 하고 조용히 넘어간다.
    // 이게 없으면 "undefined는 함수가 아니다" 에러로 앱이 죽는다.
    uploadOptions?.handleUploadProgressChange?.(100);
    return response;
  }

  /**
   * ★ 모든 요청이 거쳐 가는 공통 처리 지점.
   *
   * axios에는 인터셉터가 있어서 공통 처리를 자동으로 끼워 넣을 수 있었다.
   * fetch에는 그런 게 없으니, "전부 이 함수를 통해서만 요청한다"는 규칙을 스스로 만든다.
   * 결과적으로 인터셉터와 같은 효과를 얻는다.
   *
   * `private` = 이 클래스 안에서만 쓸 수 있다. 바깥에서는 못 부른다.
   *   이 함수는 내부 구현 세부사항이지 공개된 기능이 아니기 때문이다.
   *   공개 범위를 좁게 유지하면 나중에 마음대로 고쳐도 다른 코드가 안 깨진다.
   */
  private async sendRequest<ResponseData>(
    completeRequestUrl: string,
    // RequestInit = fetch의 두 번째 인자 타입. 브라우저가 제공하는 기본 타입이다.
    requestConfiguration: RequestInit,
  ): Promise<ResponseData> {
    // 전달받은 설정을 펼치고, credentials만 덧붙인 새 객체를 만든다.
    // 원본 requestConfiguration을 직접 고치지 않는 것 = 불변성을 지키는 습관이다.
    //
    // credentials: "include" → 쿠키를 함께 보낸다. (axios의 withCredentials와 같은 역할)
    // fetch의 기본값은 same-origin이라, 이걸 안 적으면
    // 다른 포트의 백엔드로 보낼 때 로그인 쿠키가 안 실려서 계속 401이 뜬다.
    const requestWithCredentials: RequestInit = {
      ...requestConfiguration,
      credentials: "include",
    };

    // performance.now(): 아주 정밀한 시각을 밀리초로 돌려준다.
    // Date.now()보다 정확하고, 시스템 시계가 바뀌어도 영향을 받지 않아 시간 측정에 적합하다.
    const requestStartedAt = performance.now();
    applicationLogger.info("[FetchHttpClient] 요청 시작", {
      completeRequestUrl,
      requestMethod: requestWithCredentials.method,
    });

    // 실제 요청. 여기서 서버 응답이 올 때까지 기다린다.
    const response = await fetch(completeRequestUrl, requestWithCredentials);
    const responseData = await this.parseResponse<ResponseData>(response);
    const elapsedMilliseconds = performance.now() - requestStartedAt;

    // ★★ fetch를 쓸 때 가장 중요한 다섯 줄이다.
    //
    //   response.ok 는 상태 코드가 200~299일 때만 true다.
    //   404나 500을 받아도 fetch 자체는 성공으로 처리하므로,
    //   여기서 직접 확인하고 에러를 던져 줘야 한다.
    //
    //   이 처리를 빠뜨리면 어떻게 되나?
    //     - 404 응답의 오류 본문이 정상 데이터인 척 화면으로 넘어간다
    //     - 화면은 빈 내용을 그리면서 오류 표시는 안 한다
    //     - TanStack Query도 성공으로 알고 캐시에 저장한다
    //   원인 찾기 정말 어려운 버그가 된다.
    //
    //   `{ cause: responseData }`로 서버가 보낸 오류 본문을 함께 실어 보낸다.
    //   apiErrorHelpers.ts의 5단계 검사가 이 cause를 꺼내서 쓴다. 둘이 짝이다.
    if (!response.ok) {
      applicationLogger.error("[FetchHttpClient] HTTP 오류", {
        responseStatus: response.status,
        responseData,
      });
      throw new Error("API 요청이 실패했습니다.", { cause: responseData });
    }

    applicationLogger.info("[FetchHttpClient] 응답 성공", {
      responseStatus: response.status,
      // toFixed(2): 소수점 두 자리까지만 남긴다. (12.3456789 → "12.35")
      elapsedMilliseconds: elapsedMilliseconds.toFixed(2),
      traceId: response.headers.get("X-Request-Id"),
    });
    return responseData;
  }

  /**
   * 응답 본문을 상황에 맞게 해석한다.
   *
   * axios는 이걸 자동으로 해 주지만 fetch는 직접 해야 한다.
   * 게다가 응답이 항상 JSON이라는 보장이 없어서 경우를 나눠야 한다.
   */
  private async parseResponse<ResponseData>(response: Response): Promise<ResponseData> {
    // 204 No Content = "처리는 성공했는데 돌려줄 내용은 없다".
    // 삭제(DELETE) 요청의 흔한 응답이다.
    //
    // ★ 이 검사를 빼먹으면 어떻게 되나?
    //   본문이 텅 빈 상태에서 response.json()을 부르면
    //   "Unexpected end of JSON input" 이라는 에러가 난다.
    //   삭제는 분명 성공했는데 화면에는 오류가 뜨는 황당한 상황이 된다.
    if (response.status === 204) {
      // `as ResponseData`는 타입 단언이다. "이 값을 이 타입으로 봐 달라"는 뜻.
      // 원래는 되도록 피해야 하지만, 여기서는 "내용 없음"을 표현할 방법이
      // undefined뿐이라 어쩔 수 없이 쓴다. 이런 예외적 상황에만 쓰자.
      return undefined as ResponseData;
    }

    // 응답 헤더를 보고 본문이 어떤 형식인지 확인한다.
    const contentType = response.headers.get("content-type");

    // includes로 검사하는 이유:
    // 실제 값은 "application/json; charset=UTF-8" 처럼 뒤에 뭐가 더 붙어 있다.
    // `=== "application/json"` 으로 비교하면 통과하지 못한다.
    //
    // JSON이 아니면 그냥 텍스트로 읽는다.
    // 서버가 오류 시 HTML 페이지를 돌려주는 경우 등에 대비한 것이다.
    return contentType?.includes("application/json")
      ? ((await response.json()) as ResponseData)
      : ((await response.text()) as ResponseData);
  }
}

// AxiosHttpClient와 마찬가지로 인스턴스를 하나만 만들어 공유한다(싱글턴).
export const fetchHttpClient = new FetchHttpClient();
