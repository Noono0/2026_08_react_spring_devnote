import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { FileUploadResponse } from "../types/fileTypes";

export const uploadAttachmentFile = async (
  attachmentFile: File,
  handleUploadProgressChange?: (uploadProgressPercentage: number) => void,
): Promise<FileUploadResponse> => {
  const formData = new FormData();
  formData.append("attachmentFile", attachmentFile);
  const response = await selectedHttpClient.upload<ApiResponse<FileUploadResponse>>(
    "/files/attachments",
    formData,
    { handleUploadProgressChange },
  );
  return response.data;
};

export const uploadEditorImage = async (
  imageFile: File,
): Promise<FileUploadResponse & { contentUrl: string }> => {
  const formData = new FormData();
  formData.append("imageFile", imageFile);
  const response = await selectedHttpClient.upload<ApiResponse<FileUploadResponse>>(
    "/files/editor-images",
    formData,
  );
  if (!response.data.contentUrl) {
    throw new Error("이미지 표시 URL이 응답에 없습니다.");
  }
  return response.data as FileUploadResponse & { contentUrl: string };
};
