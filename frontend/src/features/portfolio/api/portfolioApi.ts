/**
 * portfolioApi.ts — 포트폴리오 섹션 API 호출 모음
 *
 * selectedHttpClient: 설정에 따라 fetch 또는 axios 구현을 고른 공통 HTTP 클라이언트(오류 형식·traceId 처리 포함).
 * 응답은 ApiResponse<T>({ success, data, … }) 모양이라 .data만 꺼내 돌려준다.
 */
import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { FileUploadResponse } from "@/features/file/types/fileTypes";
import type {
  PortfolioSection,
  PortfolioSectionSaveRequest,
} from "@/features/portfolio/types/portfolioTypes";

// 편집 요청 표시 헤더. 서버 PortfolioEditSessionService가 이 헤더가 없으면 변경 요청을 거부한다.
const editorRequestOptions = { requestHeaders: { "X-Portfolio-Editor": "true" } };

export const getPortfolioSections = async (): Promise<PortfolioSection[]> => {
  const response = await selectedHttpClient.get<ApiResponse<PortfolioSection[]>>("/portfolio/sections");
  return response.data;
};

export const createPortfolioSection = async (
  saveRequest: PortfolioSectionSaveRequest,
): Promise<PortfolioSection> => {
  const response = await selectedHttpClient.post<PortfolioSectionSaveRequest, ApiResponse<PortfolioSection>>(
    "/portfolio/sections",
    saveRequest,
    editorRequestOptions,
  );
  return response.data;
};

export const updatePortfolioSection = async (
  portfolioSectionId: number,
  saveRequest: PortfolioSectionSaveRequest,
): Promise<PortfolioSection> => {
  const response = await selectedHttpClient.put<PortfolioSectionSaveRequest, ApiResponse<PortfolioSection>>(
    `/portfolio/sections/${portfolioSectionId}`,
    saveRequest,
    editorRequestOptions,
  );
  return response.data;
};

export const deletePortfolioSection = async (
  portfolioSectionId: number,
  versionNumber: number,
): Promise<void> => {
  // 버전은 쿼리 문자열(?versionNumber=3)로 보낸다. 버전이 다르면 서버가 409(다른 곳에서 먼저 수정)로 거부한다.
  await selectedHttpClient.delete<void>(`/portfolio/sections/${portfolioSectionId}`, {
    ...editorRequestOptions,
    queryParameters: { versionNumber },
  });
};

export const uploadPortfolioEditorImage = async (
  imageFile: File,
): Promise<FileUploadResponse & { contentUrl: string }> => {
  // 파일은 JSON이 아니라 FormData(multipart/form-data)로 보낸다. "imageFile"은 서버 @RequestPart 이름과 같아야 한다.
  const formData = new FormData();
  formData.append("imageFile", imageFile);
  const response = await selectedHttpClient.upload<ApiResponse<FileUploadResponse>>(
    "/portfolio/editor-images",
    formData,
    editorRequestOptions,
  );
  // 이미지 업로드인데 표시 주소가 없으면 에디터에 넣을 수 없으므로 오류로 처리하고, 확인 후 타입을 좁혀 돌려준다.
  if (!response.data.contentUrl) throw new Error("이미지 표시 URL이 응답에 없습니다.");
  return response.data as FileUploadResponse & { contentUrl: string };
};
