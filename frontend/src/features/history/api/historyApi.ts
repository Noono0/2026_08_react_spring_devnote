/**
 * ============================================================================
 * historyApi.ts — 포트폴리오 "업무 History" 서버 요청 모음 (API 계층)
 * ============================================================================
 *
 * [계층 구조]
 *   페이지 (HistoryListPage 등)  → 훅 (useHistoryQueries.ts) → API (여기) → HttpClient
 *
 * [백엔드 짝]
 *   backend/.../document/controller/HistoryController.java  (/api/v1/history)
 *   - 조회는 누구나 할 수 있지만, 슈퍼관리자가 아니면 서버가 발행(PUBLISHED) 글만 돌려준다.
 *   - 작성·수정·삭제는 슈퍼관리자만 가능하다. 화면에서 버튼을 숨기는 것과 별개로 서버가 403으로 막는다.
 *
 * [14단계 학습용 문서 API와 나눈 이유]
 *   예전에는 practice 문서 API 한 파일이 `history` 스위치로 /documents와 /history를 오갔다.
 *   학습자가 실습하며 그 파일을 고치면 실제 포트폴리오 요청까지 바뀌는 문제가 있어서,
 *   업무 History 전용 요청을 이 파일로 분리했다.
 */

import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import type {
  HistoryDetail,
  HistoryListResponse,
  HistorySaveRequest,
  HistorySearchCondition,
  HistoryTagCount,
} from "../types/historyTypes";
import { applicationLogger } from "@/shared/logging/applicationLogger";

// 이 파일의 모든 요청이 쓰는 기본 주소. (HttpClient가 앞에 /api/v1을 붙인다)
const historyBasePath = "/history";

/** 【Read】 업무 History 목록 — GET /history?searchKeyword=...&pageNumber=0... */
export const getHistoryList = async (
  historySearchCondition: HistorySearchCondition,
  abortSignal?: AbortSignal,
): Promise<HistoryListResponse> => {
  applicationLogger.info("[historyApi] 업무 History 목록 조회 시작", { historySearchCondition });
  const response = await selectedHttpClient.get<ApiResponse<HistoryListResponse>>(historyBasePath, {
    // 검색 조건 객체를 넘기면 HttpClient가 쿼리스트링으로 바꿔 준다.
    queryParameters: historySearchCondition,
    abortSignal,
  });
  // 봉투({ success, code, message, data })를 벗겨 알맹이만 돌려준다.
  return response.data;
};

/** 【Read】 업무 History 상세 — GET /history/{id} */
export const getHistoryDetail = async (documentId: number, abortSignal?: AbortSignal): Promise<HistoryDetail> => {
  const response = await selectedHttpClient.get<ApiResponse<HistoryDetail>>(`${historyBasePath}/${documentId}`, { abortSignal });
  return response.data;
};

/**
 * 【Create】 업무 History 작성 — POST /history
 * 등록·수정·삭제에는 abortSignal을 받지 않는다. 저장 중에 취소하면 "서버에는 저장됐는데 화면은 실패"처럼 어긋날 수 있다.
 */
export const createHistory = async (historySaveRequest: HistorySaveRequest): Promise<HistoryDetail> => {
  const response = await selectedHttpClient.post<HistorySaveRequest, ApiResponse<HistoryDetail>>(historyBasePath, historySaveRequest);
  return response.data;
};

/** 【Update】 업무 History 수정 — PUT /history/{id}. 버전이 다르면 409(DOCUMENT_VERSION_CONFLICT)로 거부된다. */
export const updateHistory = async (documentId: number, historySaveRequest: HistorySaveRequest): Promise<HistoryDetail> => {
  const response = await selectedHttpClient.put<HistorySaveRequest, ApiResponse<HistoryDetail>>(
    `${historyBasePath}/${documentId}`,
    historySaveRequest,
  );
  return response.data;
};

/** 【Delete】 업무 History 삭제 — DELETE /history/{id}. 성공하면 본문 없는 204가 온다. */
export const deleteHistory = async (documentId: number): Promise<void> => {
  await selectedHttpClient.delete<void>(`${historyBasePath}/${documentId}`);
};

/**
 * 【Read】 업무 History 태그 목록 — GET /history/tags
 * 태그 필터 버튼에 쓴다. 방문자에게는 공개 글의 태그만 집계되어 온다.
 */
export const getHistoryTags = async (abortSignal?: AbortSignal): Promise<HistoryTagCount[]> => {
  const response = await selectedHttpClient.get<ApiResponse<HistoryTagCount[]>>(`${historyBasePath}/tags`, { abortSignal });
  return response.data;
};
