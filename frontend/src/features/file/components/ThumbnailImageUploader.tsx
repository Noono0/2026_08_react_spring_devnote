import { useRef, useState } from "react";
import { uploadEditorImage } from "../api/fileApi";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import type { FileUploadResponse } from "@/features/file/types/fileTypes";

interface ThumbnailImageUploaderProperties {
  thumbnailImageUrl?: string;
  handleThumbnailChange: (thumbnailFileId: number | undefined, thumbnailImageUrl: string | undefined) => void;
  imageUploadFunction?: (imageFile: File) => Promise<FileUploadResponse & { contentUrl: string }>;
  title?: string;
  description?: string;
}

export const ThumbnailImageUploader = ({
  thumbnailImageUrl,
  handleThumbnailChange,
  imageUploadFunction = uploadEditorImage,
  title = "대표 이미지",
  description = "목록과 카드에서 대표 이미지로 사용됩니다.",
}: ThumbnailImageUploaderProperties) => {
  const fileInputReference = useRef<HTMLInputElement>(null);
  const [isUploading, setUploading] = useState(false);

  const uploadThumbnailImage = async (imageFile: File): Promise<void> => {
    if (!imageFile.type.startsWith("image/")) {
      applicationNotification.warning("이미지 파일만 대표 이미지로 사용할 수 있습니다.");
      return;
    }

    setUploading(true);
    try {
      const uploadedImage = await imageUploadFunction(imageFile);
      handleThumbnailChange(uploadedImage.fileId, uploadedImage.contentUrl);
      applicationNotification.success("대표 이미지를 업로드했습니다.");
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    } finally {
      setUploading(false);
      if (fileInputReference.current) fileInputReference.current.value = "";
    }
  };

  return (
    <section className="thumbnail-uploader">
      <div className="thumbnail-uploader-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => fileInputReference.current?.click()} disabled={isUploading}>
            {isUploading ? "업로드 중..." : thumbnailImageUrl ? "이미지 변경" : "이미지 선택"}
          </button>
          {thumbnailImageUrl ? (
            <button type="button" className="ghost-button" onClick={() => handleThumbnailChange(undefined, undefined)}>
              대표 이미지 제거
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={fileInputReference}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(changeEvent) => {
          const selectedImageFile = changeEvent.target.files?.[0];
          if (selectedImageFile) void uploadThumbnailImage(selectedImageFile);
        }}
      />
      <div className="thumbnail-preview-frame">
        {thumbnailImageUrl ? (
          <img src={thumbnailImageUrl} alt="현재 대표 이미지 미리보기" />
        ) : (
          <div className="thumbnail-placeholder-large">
            <span>IMAGE</span>
            <small>대표 이미지가 없습니다.</small>
          </div>
        )}
      </div>
    </section>
  );
};
