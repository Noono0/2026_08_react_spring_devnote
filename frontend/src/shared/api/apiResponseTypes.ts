/**
 * ============================================================================
 * apiResponseTypes.ts — 백엔드가 돌려주는 응답 "봉투"의 모양
 * ============================================================================
 *
 * 이 프로젝트의 백엔드(Spring Boot)는 어떤 API든 항상 같은 껍데기로 감싸서 보낸다.
 * 실제 데이터는 그 안의 `data` 칸에 들어 있다.
 *
 *   {
 *     "success": true,
 *     "code": "OK",
 *     "message": "조회에 성공했습니다.",
 *     "data": { "documentId": 1, "title": "첫 글" },   ← 진짜 알맹이
 *     "traceId": "a1b2c3..."
 *   }
 *
 * [왜 굳이 봉투로 감쌀까? 그냥 데이터만 주면 안 되나?]
 *   - 성공이든 실패든 응답 모양이 항상 같아서 처리 코드를 한 곳에 모을 수 있다
 *   - 오류일 때 code/message로 "무엇이 왜 잘못됐는지"를 일관되게 전달할 수 있다
 *   - traceId로 프론트에서 본 오류와 서버 로그를 연결해 추적할 수 있다
 *
 * ★ 중요: 이 봉투를 벗기는 일은 HttpClient가 대신 해 준다.
 *   그래서 페이지나 훅에서는 `response.data.data` 같은 걸 볼 일이 없고,
 *   알맹이만 바로 받는다. (AxiosHttpClient.ts에서 그 과정을 확인할 수 있다)
 */

// <ResponseData>는 제네릭 빈칸이다. 쓸 때 실제 타입을 채워 넣는다.
//   ApiResponse<DocumentSummary>      → data가 DocumentSummary 하나
//   ApiResponse<DocumentSummary[]>    → data가 DocumentSummary 배열
export interface ApiResponse<ResponseData> {
  // 요청이 성공했는지. 실패 시 false.
  // ★ HTTP 상태 코드(200/404 등)와는 별개의 값이라는 점에 주의.
  //   상태 코드는 200인데 success가 false인 "업무 규칙 위반" 응답도 있을 수 있다.
  success: boolean;

  // 결과를 구분하는 코드 문자열. 예: "OK", "DOCUMENT_NOT_FOUND"
  // 사람이 읽는 message와 달리, 프로그램이 조건 분기에 쓰라고 있는 값이다.
  // (문구는 언제든 바뀔 수 있으니 message로 분기하면 안 된다)
  code: string;

  // 사용자에게 그대로 보여줄 수 있는 한국어 안내 문구.
  message: string;

  // 실제 알맹이 데이터. 타입은 API마다 다르므로 제네릭으로 비워 뒀다.
  data: ResponseData;

  // 요청 추적용 고유 번호. `?`가 붙어 있으니 없을 수도 있다.
  // 사용자가 "오류 났어요"라고 신고할 때 이 값으로 서버 로그를 정확히 찾아낼 수 있다.
  traceId?: string;
}
