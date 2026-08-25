/**
 * ============================================================================
 * diagramApi.ts — 다이어그램 서버 요청 모음
 * ============================================================================
 *
 * documentApi.ts 와 완전히 같은 구조다.
 * 봉투(ApiResponse)를 여기서 벗겨서, 훅과 화면은 알맹이만 다루게 한다.
 */

import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { applicationLogger } from "@/shared/logging/applicationLogger";
import type {
  DiagramDetail,
  DiagramListResponse,
  DiagramSaveRequest,
  DiagramSearchCondition,
  DiagramVersion,
} from "../types/diagramTypes";

/** 【Read】 내 다이어그램 목록 — GET /diagrams */
export const getDiagramList = async (
  searchCondition: DiagramSearchCondition,
  abortSignal?: AbortSignal,
): Promise<DiagramListResponse> => {
  applicationLogger.info("[diagramApi] 다이어그램 목록 조회", { searchCondition });
  const response = await selectedHttpClient.get<ApiResponse<DiagramListResponse>>("/diagrams", {
    queryParameters: searchCondition,
    abortSignal,
  });
  return response.data;
};

/** 【Read】 상세 — GET /diagrams/{id} */
export const getDiagramDetail = async (
  diagramId: number,
  abortSignal?: AbortSignal,
): Promise<DiagramDetail> => {
  const response = await selectedHttpClient.get<ApiResponse<DiagramDetail>>(
    `/diagrams/${diagramId}`,
    { abortSignal },
  );
  return response.data;
};

/** 【Create】 등록 — POST /diagrams */
export const createDiagram = async (saveRequest: DiagramSaveRequest): Promise<DiagramDetail> => {
  const response = await selectedHttpClient.post<DiagramSaveRequest, ApiResponse<DiagramDetail>>(
    "/diagrams",
    saveRequest,
  );
  return response.data;
};

/**
 * 【Update】 수정 — PUT /diagrams/{id}
 * versionNumber 가 서버와 다르면 409 DIAGRAM_VERSION_CONFLICT 가 돌아온다.
 */
export const updateDiagram = async (
  diagramId: number,
  saveRequest: DiagramSaveRequest,
): Promise<DiagramDetail> => {
  const response = await selectedHttpClient.put<DiagramSaveRequest, ApiResponse<DiagramDetail>>(
    `/diagrams/${diagramId}`,
    saveRequest,
  );
  return response.data;
};

/** 【Delete】 삭제(soft delete) — DELETE /diagrams/{id} */
export const deleteDiagram = async (diagramId: number): Promise<void> => {
  await selectedHttpClient.delete<void>(`/diagrams/${diagramId}`);
};

/** 【Read】 버전 목록 — GET /diagrams/{id}/versions (모델 JSON 제외) */
export const getDiagramVersionList = async (
  diagramId: number,
  abortSignal?: AbortSignal,
): Promise<DiagramVersion[]> => {
  const response = await selectedHttpClient.get<ApiResponse<DiagramVersion[]>>(
    `/diagrams/${diagramId}/versions`,
    { abortSignal },
  );
  return response.data;
};

/** 【Read】 특정 버전 — GET /diagrams/{id}/versions/{n} (모델 JSON 포함) */
export const getDiagramVersion = async (
  diagramId: number,
  versionNumber: number,
  abortSignal?: AbortSignal,
): Promise<DiagramVersion> => {
  const response = await selectedHttpClient.get<ApiResponse<DiagramVersion>>(
    `/diagrams/${diagramId}/versions/${versionNumber}`,
    { abortSignal },
  );
  return response.data;
};

/** 이전 버전으로 되돌리기 — POST /diagrams/{id}/versions/{n}/restore */
export const restoreDiagramVersion = async (
  diagramId: number,
  versionNumber: number,
): Promise<DiagramDetail> => {
  const response = await selectedHttpClient.post<undefined, ApiResponse<DiagramDetail>>(
    `/diagrams/${diagramId}/versions/${versionNumber}/restore`,
  );
  return response.data;
};
