import { useState, type ChangeEvent } from "react";
import { uploadAttachmentFile } from "../api/fileApi";
import type { DocumentAttachment } from "../types/fileTypes";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";

interface AttachmentFileUploaderProperties {
  attachmentFiles: DocumentAttachment[];
  handleAttachmentFilesChange: (attachmentFiles: DocumentAttachment[]) => void;
}

const MAXIMUM_ATTACHMENT_COUNT = 20;

export const AttachmentFileUploader = ({
  attachmentFiles,
  handleAttachmentFilesChange,
}: AttachmentFileUploaderProperties) => {
  const [uploadProgressPercentage, setUploadProgressPercentage] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (changeEvent: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFile = changeEvent.target.files?.[0];
    if (!selectedFile) {
      return;
    }
    if (attachmentFiles.length >= MAXIMUM_ATTACHMENT_COUNT) {
      applicationNotification.warning(`첨부파일은 최대 ${MAXIMUM_ATTACHMENT_COUNT}개까지 등록할 수 있습니다.`);
      changeEvent.target.value = "";
      return;
    }

    setIsUploading(true);
    setUploadProgressPercentage(0);
    try {
      const uploadedFile = await uploadAttachmentFile(selectedFile, setUploadProgressPercentage);
      const nextAttachment: DocumentAttachment = {
        fileId: uploadedFile.fileId,
        originalFileName: uploadedFile.originalFileName,
        mimeType: uploadedFile.mimeType,
        fileSize: uploadedFile.fileSize,
        downloadUrl: uploadedFile.downloadUrl,
      };
      handleAttachmentFilesChange([...attachmentFiles, nextAttachment]);
      applicationNotification.success("파일을 업로드했습니다.", uploadedFile.originalFileName);
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    } finally {
      setIsUploading(false);
      changeEvent.target.value = "";
    }
  };

  return (
    <section className="file-uploader">
      <div className="thumbnail-uploader-heading">
        <div>
          <h3>첨부파일</h3>
          <p>업로드한 파일 ID는 문서 저장 요청에 포함되고, 상세 화면에서 다시 다운로드할 수 있습니다.</p>
        </div>
        <span>{attachmentFiles.length} / {MAXIMUM_ATTACHMENT_COUNT}</span>
      </div>
      <input
        type="file"
        onChange={(changeEvent) => void handleFileChange(changeEvent)}
        disabled={isUploading || attachmentFiles.length >= MAXIMUM_ATTACHMENT_COUNT}
      />
      {isUploading ? <progress max={100} value={uploadProgressPercentage} /> : null}
      {attachmentFiles.length > 0 ? (
        <ul className="attachment-file-list">
          {attachmentFiles.map((attachmentFile) => (
            <li key={attachmentFile.fileId}>
              <div>
                <strong>{attachmentFile.originalFileName}</strong>
                <small>{Math.ceil(attachmentFile.fileSize / 1024).toLocaleString()} KB</small>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  handleAttachmentFilesChange(
                    attachmentFiles.filter((file) => file.fileId !== attachmentFile.fileId),
                  );
                }}
              >
                연결 제거
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>아직 연결할 첨부파일이 없습니다.</p>
      )}
      <p>허용 확장자와 최대 크기는 백엔드에서도 다시 검증합니다.</p>
    </section>
  );
};
