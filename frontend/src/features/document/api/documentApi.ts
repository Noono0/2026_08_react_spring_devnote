/**
 * ============================================================================
 * documentApi.ts — 문서 관련 서버 요청 모음 (API 계층)
 * ============================================================================
 *
 * [계층 구조에서 이 파일의 위치]
 *
 *   페이지 (DocumentListPage.tsx)        "화면을 그린다"
 *      ↓ 사용
 *   훅   (useDocumentQueries.ts)         "캐싱·로딩·오류를 관리한다"
 *      ↓ 사용
 *   API  (여기)                          "어떤 주소로 무엇을 보낼지 안다"  ← 지금 여기
 *      ↓ 사용
 *   HttpClient (Axios/Fetch)             "실제로 네트워크로 보낸다"
 *
 * ★ 왜 이렇게 층을 나눌까?
 *   각 층이 자기 일만 알면 되기 때문이다.
 *     - 페이지는 API 주소를 몰라도 된다
 *     - API는 캐싱이나 로딩 스피너를 몰라도 된다
 *     - HttpClient는 문서가 뭔지 몰라도 된다
 *   주소가 바뀌면 이 파일만, 캐시 정책이 바뀌면 훅만 고치면 된다.
 *
 * [모든 함수에 있는 `history` 인자]
 *   이 앱은 같은 문서 기능을 두 곳에서 쓴다.
 *     /react/documents → 학습용 연습 (엔드포인트 /documents)
 *     /history         → 포트폴리오의 업무 기록 (엔드포인트 /history)
 *   데이터만 다르고 동작은 같아서, 코드를 복사하지 않고 스위치 하나로 나눴다.
 */

import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import type {
  DocumentDetail,
  DocumentListResponse,
  DocumentSaveRequest,
  DocumentSearchCondition,
} from "../types/documentTypes";
import { applicationLogger } from "@/shared/logging/applicationLogger";

/**
 * 【Read】 문서 목록 조회 — GET /documents?searchKeyword=...&pageNumber=1...
 */
export const getDocumentList = async (
  documentSearchCondition: DocumentSearchCondition,
  abortSignal?: AbortSignal,
  history = false,
): Promise<DocumentListResponse> => {
  applicationLogger.info("[documentApi] 문서 목록 조회 시작", { documentSearchCondition });

  // ★ 제네릭에 `ApiResponse<DocumentListResponse>` 를 넣은 것에 주목.
  //   서버는 항상 { success, code, message, data } 봉투에 담아 보낸다.
  //   그래서 봉투 타입 안에 알맹이 타입을 넣어 표현한다.
  const response = await selectedHttpClient.get<ApiResponse<DocumentListResponse>>(history ? "/history" : "/documents", {
    // 검색 조건 객체를 통째로 넘기면 HttpClient가 쿼리스트링으로 만들어 준다.
    queryParameters: documentSearchCondition,
    abortSignal,
  });

  // ★ `response.data` 로 봉투를 벗겨서 알맹이만 돌려준다.
  //   이 한 줄 덕분에 훅과 페이지는 봉투의 존재를 몰라도 된다.
  //   나중에 백엔드가 봉투 구조를 바꿔도 이 API 파일만 고치면 된다.
  return response.data;
};

/**
 * 【Read】 문서 상세 조회 — GET /documents/{id}
 */
export const getDocumentDetail = async (
  documentId: number,
  abortSignal?: AbortSignal,
  history = false,
): Promise<DocumentDetail> => {
  const response = await selectedHttpClient.get<ApiResponse<DocumentDetail>>(
    // 백틱으로 주소를 조립한다. "/documents/42" 같은 형태가 된다.
    `${history ? "/history" : "/documents"}/${documentId}`,
    { abortSignal },
  );
  return response.data;
};

/**
 * 【Create】 문서 등록 — POST /documents
 *
 * ★ 제네릭이 두 개인 이유:
 *     첫 번째 DocumentSaveRequest    → 보내는 데이터의 타입
 *     두 번째 ApiResponse<DocumentDetail> → 받는 데이터의 타입
 *   보내는 것과 받는 것이 다르다. (보낼 땐 id가 없고, 받을 땐 서버가 붙여 준다)
 *
 * ★ 조회 함수와 달리 abortSignal이 없다.
 *   등록/수정 요청은 중간에 취소하면 안 된다.
 *   "취소했는데 서버에는 이미 저장됐다"면 화면과 실제가 어긋난다.
 *   조회는 취소해도 아무 일도 안 일어나므로 취소해도 안전하다.
 */
export const createDocument = async (
  documentSaveRequest: DocumentSaveRequest,
  history = false,
): Promise<DocumentDetail> => {
  const response = await selectedHttpClient.post<
    DocumentSaveRequest,
    ApiResponse<DocumentDetail>
  >(history ? "/history" : "/documents", documentSaveRequest);
  return response.data;
};

/**
 * 【Update】 문서 수정 — PUT /documents/{id}
 *
 * 이 요청이 실패하는 대표적인 경우가 DOCUMENT_VERSION_CONFLICT(409)다.
 * 요청 안의 versionNumber가 서버의 현재 버전과 다르면 서버가 거부한다.
 * → DocumentEditorPage.tsx에서 그 처리를 확인하자.
 */
export const updateDocument = async (
  documentId: number,
  documentSaveRequest: DocumentSaveRequest,
  history = false,
): Promise<DocumentDetail> => {
  const response = await selectedHttpClient.put<
    DocumentSaveRequest,
    ApiResponse<DocumentDetail>
  >(`${history ? "/history" : "/documents"}/${documentId}`, documentSaveRequest);
  return response.data;
};

/**
 * 【Delete】 문서 삭제 — DELETE /documents/{id}
 *
 * ★ `Promise<void>` 다. 돌려줄 게 없다는 뜻이다.
 *   삭제 성공 응답은 보통 204 No Content(본문 없음)이다.
 *   그래서 return 문도 없다.
 *   (FetchHttpClient가 204를 어떻게 처리하는지 다시 보면 이해가 깊어진다)
 */
export const deleteDocument = async (documentId: number, history = false): Promise<void> => {
  await selectedHttpClient.delete<void>(`${history ? "/history" : "/documents"}/${documentId}`);
};
