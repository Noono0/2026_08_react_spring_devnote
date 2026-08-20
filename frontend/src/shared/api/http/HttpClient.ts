/**
 * ============================================================================
 * HttpClient.ts — "서버와 통신하는 도구"가 지켜야 할 약속(인터페이스)
 * ============================================================================
 *
 * [이 파일에는 실행되는 코드가 한 줄도 없다]
 *   여기 있는 건 전부 `interface`, 즉 TypeScript의 "설계도"다.
 *   빌드하고 나면 이 파일은 통째로 사라진다. 오직 개발 중 타입 검사용이다.
 *
 * [왜 이런 약속이 필요한가?]
 *   서버에 요청을 보내는 방법은 여러 가지다.
 *     - axios 라이브러리 사용
 *     - 브라우저 내장 fetch 사용
 *   둘은 사용법이 꽤 다르다. 만약 페이지 코드에서 axios를 직접 쓰면,
 *   나중에 fetch로 바꿀 때 axios를 쓴 모든 파일을 다 뜯어고쳐야 한다.
 *
 *   그래서 "get, post, put, delete, upload 이 다섯 개만 있으면 된다"는
 *   약속을 먼저 정해 두고, axios 버전과 fetch 버전이 각각 그 약속을 지키게 한다.
 *   페이지 코드는 약속만 보고 쓰므로, 구현을 갈아끼워도 아무 영향이 없다.
 *
 *   이런 설계를 "인터페이스로 추상화한다"고 부른다.
 *   → 실제 구현: AxiosHttpClient.ts, FetchHttpClient.ts
 *   → 둘 중 하나 고르기: selectedHttpClient.ts
 */

/** 모든 요청에 공통으로 붙일 수 있는 선택 옵션들. */
export interface HttpRequestOptions {
  // 주소 뒤에 붙일 `?key=value` 값들. { page: 1, size: 10 } 같은 객체로 넘긴다.
  // 직접 문자열을 이어 붙이는 것보다 안전하다 (특수문자 처리를 대신 해 준다).
  queryParameters?: object;

  // 이 요청에만 추가로 붙일 헤더.
  // Record<string, string> = "문자열 키에 문자열 값이 붙은 객체"라는 뜻.
  //   예: { "Content-Type": "application/json" }
  requestHeaders?: Record<string, string>;

  // 진행 중인 요청을 중간에 취소하기 위한 신호.
  //
  // ★ 언제 쓰나?
  //   검색창에 "리액트"를 치면 ㄹ, 리, 릭... 글자마다 요청이 나간다.
  //   앞의 요청이 늦게 도착하면 최신 검색 결과를 덮어써 버리는 사고가 난다.
  //   또 사용자가 페이지를 떠났는데 응답이 도착하면 없는 화면을 갱신하려다 경고가 뜬다.
  //   이럴 때 "이 요청 취소해!"라고 알려 주는 게 AbortSignal이다.
  abortSignal?: AbortSignal;
}

/** 파일 업로드 전용 옵션. 일반 요청과 달리 진행률 표시가 필요하다. */
export interface FileUploadOptions {
  requestHeaders?: Record<string, string>;
  abortSignal?: AbortSignal;

  // 업로드 진행률(0~100)이 바뀔 때마다 호출되는 함수.
  //
  // 이렇게 "함수를 인자로 받는 것"을 콜백(callback)이라고 한다.
  // 이 파일은 진행률을 화면에 어떻게 보여줄지 모른다. 알 필요도 없다.
  // "몇 %인지 알려줄 테니 화면 처리는 너희가 해라"라고 넘기는 것이다.
  // 쓰는 쪽에서는 이렇게 받는다:
  //   handleUploadProgressChange: (percent) => setProgress(percent)
  handleUploadProgressChange?: (uploadProgressPercentage: number) => void;
}

/**
 * HTTP 통신 도구가 반드시 갖춰야 할 다섯 가지 기능.
 *
 * [HTTP 메서드와 CRUD의 대응 관계 — 외워 두면 편하다]
 *   GET    → 조회 (Read)    "이 데이터 좀 줘"
 *   POST   → 생성 (Create)  "이거 새로 만들어 줘"
 *   PUT    → 수정 (Update)  "이걸로 바꿔 줘"
 *   DELETE → 삭제 (Delete)  "이거 지워 줘"
 *
 * [<꺾쇠> 안에 든 건 제네릭(Generic)이다]
 *   제네릭 = "타입을 나중에 정하는 빈칸".
 *
 *   만약 제네릭이 없다면 문서 조회용 함수, 회원 조회용 함수를 따로 만들거나
 *   반환 타입을 any로 두고 타입 검사를 포기해야 한다.
 *
 *   제네릭을 쓰면 이렇게 된다:
 *     const doc = await client.get<Document>("/documents/1");
 *     → doc의 타입이 Document로 확정된다. doc.title에 오타를 내면 바로 잡힌다.
 *
 *   즉 "하나의 함수인데 쓸 때마다 타입이 정확한" 마법을 부린다.
 *
 * [Promise<T>는 뭔가?]
 *   "지금은 없지만 나중에 T 타입 값을 줄게"라는 약속 상자.
 *   네트워크 요청은 즉시 끝나지 않으므로 이런 형태가 된다.
 *   꺼내 쓸 때는 앞에 `await`를 붙여서 "다 될 때까지 기다렸다가 알맹이를 꺼낸다".
 */
export interface HttpClient {
  /** 데이터를 가져온다. 서버의 상태를 바꾸지 않는다. */
  get<ResponseData>(requestUrl: string, requestOptions?: HttpRequestOptions): Promise<ResponseData>;

  /**
   * 데이터를 새로 만든다.
   * 제네릭이 두 개인 이유: 보내는 데이터 타입과 받는 데이터 타입이 서로 다르기 때문이다.
   *   보낼 때: { title: "제목", content: "내용" }        ← id가 없다
   *   받을 때: { id: 42, title: "제목", createdAt: ... } ← 서버가 id를 붙여 준다
   */
  post<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData>;

  /** 기존 데이터를 통째로 바꾼다. */
  put<RequestData, ResponseData>(
    requestUrl: string,
    requestData?: RequestData,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData>;

  /** 데이터를 지운다. 보낼 본문이 없으므로 requestData 자리가 없다. */
  delete<ResponseData>(
    requestUrl: string,
    requestOptions?: HttpRequestOptions,
  ): Promise<ResponseData>;

  /**
   * 파일을 올린다.
   *
   * FormData: 파일처럼 글자가 아닌 데이터를 담아 보낼 때 쓰는 특별한 상자.
   * JSON은 텍스트만 담을 수 있어서 이미지 같은 걸 넣을 수 없다.
   * 그래서 파일 전송은 JSON이 아니라 FormData를 쓴다.
   */
  upload<ResponseData>(
    requestUrl: string,
    formData: FormData,
    uploadOptions?: FileUploadOptions,
  ): Promise<ResponseData>;
}
