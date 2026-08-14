export interface FileUploadResponse {
  fileId: number;
  originalFileName: string;
  fileExtension: string;
  mimeType: string;
  fileSize: number;
  fileStatus: string;
  downloadUrl: string;
  contentUrl?: string;
}

export interface DocumentAttachment {
  fileId: number;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
}
