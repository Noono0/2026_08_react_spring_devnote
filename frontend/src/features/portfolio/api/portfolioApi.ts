import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { FileUploadResponse } from "@/features/file/types/fileTypes";
import type {
  PortfolioSection,
  PortfolioSectionSaveRequest,
} from "@/features/portfolio/types/portfolioTypes";

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
  await selectedHttpClient.delete<void>(`/portfolio/sections/${portfolioSectionId}`, {
    ...editorRequestOptions,
    queryParameters: { versionNumber },
  });
};

export const uploadPortfolioEditorImage = async (
  imageFile: File,
): Promise<FileUploadResponse & { contentUrl: string }> => {
  const formData = new FormData();
  formData.append("imageFile", imageFile);
  const response = await selectedHttpClient.upload<ApiResponse<FileUploadResponse>>(
    "/portfolio/editor-images",
    formData,
    editorRequestOptions,
  );
  if (!response.data.contentUrl) throw new Error("이미지 표시 URL이 응답에 없습니다.");
  return response.data as FileUploadResponse & { contentUrl: string };
};
