/**
 * ============================================================================
 * AttachmentFileUploader.tsx — 문서 첨부파일 업로드 (진행률 표시 포함)
 * ============================================================================
 *
 * DocumentEditorPage 안에서 쓰이는 부품이다.
 * 파일을 올리고, 목록을 보여주고, 연결을 끊는 일까지 담당한다.
 *
 * ★★ 이 컴포넌트는 첨부파일 목록을 스스로 갖지 않는다.
 *   목록(attachmentFiles)은 부모(DocumentEditorPage)가 갖고 props로 내려 준다.
 *   바꿔야 할 때는 handleAttachmentFilesChange로 "이렇게 바꿔 주세요"라고 알린다.
 *
 *   왜 이렇게 하나?
 *     목록은 결국 문서를 저장할 때 부모가 서버로 보내야 하는 데이터다.
 *     자식이 들고 있으면 저장 시점에 부모가 꺼내 올 방법이 마땅치 않다.
 *     "데이터는 그걸 필요로 하는 가장 위쪽 컴포넌트가 갖는다"는 원칙을
 *     React에서는 상태 끌어올리기(lifting state up)라고 부른다.
 *
 *   반대로 "업로드 중인가", "진행률 몇 %인가"는 이 컴포넌트만 쓰는 값이라
 *   여기서 useState로 갖는다. 무엇을 어디에 둘지 나누는 좋은 예시다.
 */

import { useState, type ChangeEvent } from "react";
import { uploadAttachmentFile } from "../api/fileApi";
import type { DocumentAttachment } from "../types/fileTypes";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";

interface AttachmentFileUploaderProperties {
  attachmentFiles: DocumentAttachment[];
  handleAttachmentFilesChange: (attachmentFiles: DocumentAttachment[]) => void;
}

// 첨부 개수 상한. 매직 넘버 대신 상수로 빼 두면
// 화면 표시("3 / 20")와 검사 로직이 같은 값을 쓰게 되어 어긋날 일이 없다.
const MAXIMUM_ATTACHMENT_COUNT = 20;

export const AttachmentFileUploader = ({
  attachmentFiles,
  handleAttachmentFilesChange,
}: AttachmentFileUploaderProperties) => {
  // 0~100 사이의 업로드 진행률. 아래 <progress>가 이 값을 그린다.
  const [uploadProgressPercentage, setUploadProgressPercentage] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (changeEvent: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFile = changeEvent.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    // 개수 제한 검사. 넘으면 안내하고 입력창을 비운다.
    if (attachmentFiles.length >= MAXIMUM_ATTACHMENT_COUNT) {
      applicationNotification.warning(`첨부파일은 최대 ${MAXIMUM_ATTACHMENT_COUNT}개까지 등록할 수 있습니다.`);
      changeEvent.target.value = "";
      return;
    }

    setIsUploading(true);
    // ★ 진행률을 0으로 되돌리고 시작한다.
    //   이전 업로드가 100%로 끝났는데 초기화하지 않으면
    //   새 업로드를 시작하자마자 막대가 꽉 찬 채로 보인다.
    setUploadProgressPercentage(0);

    try {
      // ★★ setUploadProgressPercentage를 "그대로" 넘기는 부분에 주목.
      //   fileApi는 진행률이 바뀔 때마다 이 함수를 불러 준다.
      //   즉 State 변경 함수를 통째로 콜백으로 넘겨서
      //   업로드 진행 상황이 곧바로 화면에 반영되게 한 것이다.
      //   (HttpClient.ts의 handleUploadProgressChange 설명과 이어진다)
      const uploadedFile = await uploadAttachmentFile(selectedFile, setUploadProgressPercentage);

      // 서버 응답에서 화면에 필요한 항목만 골라 담는다.
      // FileUploadResponse에는 fileExtension 등 더 많은 게 오지만
      // 문서에 저장할 DocumentAttachment는 다섯 개만 쓴다.
      const nextAttachment: DocumentAttachment = {
        fileId: uploadedFile.fileId,
        originalFileName: uploadedFile.originalFileName,
        mimeType: uploadedFile.mimeType,
        fileSize: uploadedFile.fileSize,
        downloadUrl: uploadedFile.downloadUrl,
      };

      // ★ 부모에게 "새 배열"을 만들어 넘긴다.
      //   attachmentFiles.push(...) 로 원본을 고치면 안 된다.
      //   이건 부모가 소유한 State이고, 주소가 그대로면 부모 화면이 갱신되지 않는다.
      //   불변성 원칙은 부모-자식 사이에서도 똑같이 지켜야 한다.
      handleAttachmentFilesChange([...attachmentFiles, nextAttachment]);
      applicationNotification.success("파일을 업로드했습니다.", uploadedFile.originalFileName);
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    } finally {
      // ★ finally에 정리 코드를 둔다. 성공이든 실패든 반드시 실행된다.
      //   try 안에만 두면 업로드 실패 시 isUploading이 true로 남아
      //   입력창이 영원히 잠긴다. (RichTextEditor에서도 같은 이유로 finally를 썼다)
      setIsUploading(false);
      // 같은 파일을 다시 선택할 수 있도록 입력창을 비운다.
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
        {/* 현재 개수 / 최대 개수. 남은 여유를 사용자가 알 수 있게 한다. */}
        <span>{attachmentFiles.length} / {MAXIMUM_ATTACHMENT_COUNT}</span>
      </div>

      {/* 업로드 중이거나 개수가 꽉 차면 입력창을 잠근다.
          잠그지 않으면 업로드 도중에 또 파일을 골라 요청이 겹칠 수 있다. */}
      <input
        type="file"
        onChange={(changeEvent) => void handleFileChange(changeEvent)}
        disabled={isUploading || attachmentFiles.length >= MAXIMUM_ATTACHMENT_COUNT}
      />

      {/* ★ <progress>는 HTML 기본 진행 막대다. 직접 만들 필요가 없다.
            max={100} value={진행률} 만 주면 브라우저가 알아서 그려 주고,
            화면 낭독기도 "몇 퍼센트 진행"이라고 읽어 준다.
            div와 CSS 너비로 흉내 내면 그 접근성이 사라진다. */}
      {isUploading ? <progress max={100} value={uploadProgressPercentage} /> : null}

      {attachmentFiles.length > 0 ? (
        <ul className="attachment-file-list">
          {attachmentFiles.map((attachmentFile) => (
            <li key={attachmentFile.fileId}>
              <div>
                <strong>{attachmentFile.originalFileName}</strong>
                {/* 바이트를 KB로. 올림해서 0KB로 표시되는 걸 막는다. */}
                <small>{Math.ceil(attachmentFile.fileSize / 1024).toLocaleString()} KB</small>
              </div>
              {/* ★ 버튼 문구가 "삭제"가 아니라 "연결 제거"인 것이 정확하다.
                    이 버튼은 서버의 파일을 지우지 않는다.
                    "이 문서에서 뺀다"는 뜻일 뿐이고, 실제 삭제는 서버가
                    아무 문서도 참조하지 않는 파일을 정리할 때 한다.
                    버튼 문구가 실제 동작과 맞아야 사용자가 오해하지 않는다. */}
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  // filter로 새 배열을 만들어 부모에게 넘긴다.
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
        // 빈 상태 안내. 목록이 비었을 때 아무것도 안 보이면
        // 사용자는 기능이 고장 났는지 아직 안 올린 건지 알 수 없다.
        <p>아직 연결할 첨부파일이 없습니다.</p>
      )}

      {/* ★ 이 안내 문구가 중요한 사실을 담고 있다.
            프론트에서 하는 검사(개수 제한 등)는 편의일 뿐이고,
            확장자와 크기의 진짜 판정은 백엔드가 한다.
            개발자도구로 이 화면의 제한은 얼마든지 우회할 수 있기 때문이다. */}
      <p>허용 확장자와 최대 크기는 백엔드에서도 다시 검증합니다.</p>
    </section>
  );
};
