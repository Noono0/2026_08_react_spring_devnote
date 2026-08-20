/**
 * ============================================================================
 * fileTypes.ts — 파일 업로드 관련 타입
 * ============================================================================
 *
 * ★ 여기서도 "요청 타입"과 "응답 타입"을 나누는 원칙이 그대로 보인다.
 *   다만 파일 업로드는 보낼 때 JSON이 아니라 FormData를 쓰므로
 *   "보내는 타입"이 따로 없다. 받는 모양만 정의하면 된다.
 */

/**
 * 파일 하나를 업로드했을 때 서버가 돌려주는 정보.
 *
 * ★ 여기서 가장 중요한 건 `fileId`다.
 *   업로드가 끝나면 파일 자체는 이미 서버에 저장돼 있고,
 *   프론트는 이 번호만 들고 있으면 된다.
 *   문서를 저장할 때도 파일이 아니라 이 번호들만 보낸다.
 *   (DocumentSaveRequest.attachmentFileIds 참고)
 */
export interface FileUploadResponse {
  fileId: number;
  originalFileName: string;  // 사용자가 올린 원래 파일명
  fileExtension: string;
  mimeType: string;          // "image/png" 같은 파일 종류
  fileSize: number;          // 바이트 단위
  fileStatus: string;

  // 다운로드용 주소. 첨부파일 목록의 "다운로드" 링크에 쓴다.
  downloadUrl: string;

  // ★ 화면에 이미지로 띄울 때 쓰는 주소. `?`가 붙은 이유가 중요하다.
  //   이미지 파일을 올렸을 때만 값이 있고, PDF나 ZIP을 올리면 없다.
  //   그래서 쓰기 전에 반드시 존재를 확인해야 한다.
  //   (fileApi.ts의 uploadEditorImage가 그 확인을 대신 해 준다)
  contentUrl?: string;
}

/**
 * 문서에 붙어 있는 첨부파일.
 *
 * ★ FileUploadResponse보다 항목이 적다. 의도적이다.
 *   문서 상세 화면에서 첨부파일을 보여줄 때 필요한 건
 *   이름, 크기, 다운로드 주소 정도다.
 *   fileExtension이나 fileStatus까지 내려받을 이유가 없다.
 *   "필요한 만큼만 주고받는다"는 원칙이 여기서도 적용된 것이다.
 */
export interface DocumentAttachment {
  fileId: number;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
}
