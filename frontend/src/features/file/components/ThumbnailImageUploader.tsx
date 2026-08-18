/**
 * ============================================================================
 * ThumbnailImageUploader.tsx — 대표 이미지(썸네일) 업로드
 * ============================================================================
 *
 * AttachmentFileUploader와 형제 같은 컴포넌트지만 차이가 있다.
 *   첨부파일 → 여러 개, 다운로드용, 종류 제한 없음
 *   대표 이미지 → 딱 한 개, 화면 표시용, 이미지만
 *
 * ★ 그래서 "제거" 동작도 다르다.
 *   첨부파일은 목록에서 filter로 빼지만,
 *   대표 이미지는 하나뿐이라 undefined로 되돌리면 끝이다.
 *
 * [배울 개념]
 *   - 숨긴 파일 입력창 + 예쁜 버튼 조합 (RichTextEditor와 같은 방식)
 *   - props 기본값으로 컴포넌트를 재사용 가능하게 만들기
 *   - 부모가 값을 소유하는 제어 컴포넌트 구조
 */

import { useRef, useState } from "react";
import { uploadEditorImage } from "../api/fileApi";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import type { FileUploadResponse } from "@/features/file/types/fileTypes";

interface ThumbnailImageUploaderProperties {
  // 현재 대표 이미지 주소. 없으면 undefined.
  thumbnailImageUrl?: string;

  // ★ 인자가 둘 다 `| undefined`인 이유:
  //   이미지를 새로 올렸을 때는 (fileId, url)을 넘기고,
  //   제거할 때는 (undefined, undefined)를 넘긴다.
  //   한 함수로 "설정"과 "해제"를 모두 처리하는 것이다.
  handleThumbnailChange: (thumbnailFileId: number | undefined, thumbnailImageUrl: string | undefined) => void;

  // 업로드 함수를 갈아 끼울 수 있게 열어 뒀다. (테스트나 다른 업로드 경로용)
  // RichTextEditor의 imageUploadFunction과 같은 발상이다.
  imageUploadFunction?: (imageFile: File) => Promise<FileUploadResponse & { contentUrl: string }>;

  // ★ 제목과 설명까지 props로 뺀 덕분에 이 컴포넌트를 여러 곳에서 쓸 수 있다.
  //   문서에서는 "대표 이미지", 포트폴리오에서는 "프로필 사진"처럼
  //   같은 기능을 다른 이름으로 보여줄 수 있다.
  title?: string;
  description?: string;
}

export const ThumbnailImageUploader = ({
  thumbnailImageUrl,
  handleThumbnailChange,
  // 기본값을 주면 대부분의 경우 그냥 <ThumbnailImageUploader ... /> 로 쓸 수 있고,
  // 필요할 때만 덮어쓰면 된다.
  imageUploadFunction = uploadEditorImage,
  title = "대표 이미지",
  description = "목록과 카드에서 대표 이미지로 사용됩니다.",
}: ThumbnailImageUploaderProperties) => {
  // 숨겨 둔 <input type="file">을 코드로 클릭하기 위한 ref.
  const fileInputReference = useRef<HTMLInputElement>(null);
  const [isUploading, setUploading] = useState(false);

  const uploadThumbnailImage = async (imageFile: File): Promise<void> => {
    // 아래 input의 accept로 1차 필터링을 하지만,
    // "모든 파일"을 골라 우회할 수 있으므로 여기서 다시 확인한다.
    // (진짜 방어는 서버가 파일 시그니처까지 검사한다)
    if (!imageFile.type.startsWith("image/")) {
      applicationNotification.warning("이미지 파일만 대표 이미지로 사용할 수 있습니다.");
      return;
    }

    setUploading(true);
    try {
      const uploadedImage = await imageUploadFunction(imageFile);
      // ★ contentUrl에 `?.`나 확인 코드가 없다는 점에 주목.
      //   uploadEditorImage가 "없으면 에러를 던진다"고 보장해 주기 때문이다.
      //   검증을 한 곳에 모아 두면 쓰는 쪽이 이렇게 깔끔해진다.
      handleThumbnailChange(uploadedImage.fileId, uploadedImage.contentUrl);
      applicationNotification.success("대표 이미지를 업로드했습니다.");
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    } finally {
      // 성공이든 실패든 잠금을 풀고 입력창을 비운다.
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
          {/* ★ 버튼 문구가 상황에 따라 세 가지로 바뀐다.
                업로드 중  → "업로드 중..."
                이미지 있음 → "이미지 변경"
                이미지 없음 → "이미지 선택"
              삼항 연산자를 겹쳐 쓴 형태다.
              "지금 누르면 무슨 일이 일어나는지"를 버튼이 정확히 말해 주는 게 좋은 UI다. */}
          <button type="button" onClick={() => fileInputReference.current?.click()} disabled={isUploading}>
            {isUploading ? "업로드 중..." : thumbnailImageUrl ? "이미지 변경" : "이미지 선택"}
          </button>

          {/* 제거 버튼은 이미지가 있을 때만 보여준다.
              없을 때 "제거" 버튼이 있으면 누를 게 없어 혼란스럽다.
              undefined 두 개를 넘겨 부모의 값을 비운다. */}
          {thumbnailImageUrl ? (
            <button type="button" className="ghost-button" onClick={() => handleThumbnailChange(undefined, undefined)}>
              대표 이미지 제거
            </button>
          ) : null}
        </div>
      </div>

      {/* ★ 숨겨 둔 진짜 파일 입력창. (RichTextEditor와 같은 방식)
            브라우저 기본 "파일 선택" 버튼은 디자인을 바꿀 수 없어서
            input은 감추고 위의 예쁜 버튼이 대신 클릭하게 만든다.
            display:none이 아니라 visually-hidden을 쓰는 이유도 같다 — 접근성 유지. */}
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

      {/* 미리보기 영역. 이미지가 없으면 자리표시 화면을 보여준다.
          빈 네모만 있으면 "여기 뭐가 들어가야 하지?" 하고 헷갈린다. */}
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
