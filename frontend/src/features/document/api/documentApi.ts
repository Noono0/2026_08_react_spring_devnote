import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import type {
  DocumentDetail,
  DocumentListResponse,
  DocumentSaveRequest,
  DocumentSearchCondition,
} from "../types/documentTypes";
import { applicationLogger } from "@/shared/logging/applicationLogger";

export const getDocumentList = async (
  documentSearchCondition: DocumentSearchCondition,
  abortSignal?: AbortSignal,
  history = false,
): Promise<DocumentListResponse> => {
  applicationLogger.info("[documentApi] 문서 목록 조회 시작", { documentSearchCondition });
  const response = await selectedHttpClient.get<ApiResponse<DocumentListResponse>>(history ? "/history" : "/documents", {
    queryParameters: documentSearchCondition,
    abortSignal,
  });
  return response.data;
};

export const getDocumentDetail = async (
  documentId: number,
  abortSignal?: AbortSignal,
  history = false,
): Promise<DocumentDetail> => {
  const response = await selectedHttpClient.get<ApiResponse<DocumentDetail>>(
    `${history ? "/history" : "/documents"}/${documentId}`,
    { abortSignal },
  );
  return response.data;
};

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

export const deleteDocument = async (documentId: number, history = false): Promise<void> => {
  await selectedHttpClient.delete<void>(`${history ? "/history" : "/documents"}/${documentId}`);
};
