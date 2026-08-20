/**
 * ============================================================================
 * fileApi.ts — 파일 업로드 API
 * ============================================================================
 *
 * ★★ GalleryPracticePage(연습용)와 무엇이 다른가 — 이게 이 파일의 핵심이다.
 *
 *   [갤러리 연습 페이지]
 *     FileReader로 파일을 읽어 data URL("data:image/png;base64,...")을 만들고
 *     그 긴 문자열을 State에 담았다. 서버가 필요 없어 연습에는 좋다.
 *     하지만 이미지 원본이 통째로 데이터에 들어가서
 *     3MB 이미지 하나가 4MB짜리 문자열이 된다.
 *
 *   [여기 — 실무 방식]
 *     1) 파일을 서버에 올린다
 *     2) 서버가 저장하고 `fileId`와 접근 주소를 돌려준다
 *     3) 프론트는 그 번호와 주소만 들고 있는다
 *     4) 문서를 저장할 때 파일이 아니라 "번호 목록"만 보낸다
 *
 *   ★ 왜 이렇게 나누나?
 *     - 문서 저장 요청이 가벼워진다 (텍스트만 오간다)
 *     - 업로드가 실패해도 문서 작성 흐름이 안 끊긴다
 *     - 같은 파일을 여러 문서에서 재사용할 수 있다
 *     - 이미지가 브라우저 캐시에 남아 두 번째부터 빨리 뜬다
 *
 * [FormData를 쓰는 이유]
 *   JSON은 글자만 담을 수 있어서 이미지 같은 이진 데이터를 넣을 수 없다.
 *   FormData는 파일을 그대로 담아 보낼 수 있는 전용 상자다.
 *   HttpClient의 upload()가 이 FormData를 받도록 만들어져 있다.
 */

import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { FileUploadResponse } from "../types/fileTypes";

/**
 * 【첨부파일】 문서에 붙일 파일을 올린다. 이미지가 아니어도 된다.
 *
 * 두 번째 인자로 진행률 콜백을 받는다.
 *   AttachmentFileUploader가 `setUploadProgressPercentage`를 그대로 넘겨서
 *   업로드가 진행되는 동안 <progress> 막대가 차오르게 만든다.
 *
 * ★ 단, 진행률은 axios를 쓸 때만 실제로 동작한다.
 *   fetch는 업로드 진행률을 알려주는 기능이 아예 없어서 100%만 한 번 온다.
 *   (FetchHttpClient.ts의 upload() 주석 참고)
 */
export const uploadAttachmentFile = async (
  attachmentFile: File,
  handleUploadProgressChange?: (uploadProgressPercentage: number) => void,
): Promise<FileUploadResponse> => {
  // FormData에 파일을 담는다.
  // ★ 첫 번째 인자 "attachmentFile"은 서버가 기대하는 이름이다.
  //   백엔드 컨트롤러의 @RequestPart 이름과 정확히 같아야 한다.
  //   한 글자만 달라도 서버는 "파일이 안 왔다"며 400을 돌려준다.
  //   프론트와 백엔드가 맞춰야 하는 또 하나의 계약이다.
  const formData = new FormData();
  formData.append("attachmentFile", attachmentFile);

  // ★ get/post가 아니라 upload()를 쓴다.
  //   Content-Type을 브라우저가 알아서 정하도록 비워 두는 등
  //   파일 전송에 필요한 처리가 그 안에 들어 있다.
  const response = await selectedHttpClient.upload<ApiResponse<FileUploadResponse>>(
    "/files/attachments",
    formData,
    { handleUploadProgressChange },
  );
  return response.data;
};

/**
 * 【본문·대표 이미지】 화면에 표시할 이미지를 올린다.
 *
 * 첨부파일 업로드와 거의 같지만 결정적인 차이가 하나 있다.
 * 반환 타입이 `FileUploadResponse & { contentUrl: string }` 이다.
 *
 * ★ 이 교차 타입(`&`)이 무슨 뜻인가?
 *   원래 contentUrl은 `?`가 붙어 "없을 수도 있는" 값이다.
 *   그래서 쓰는 쪽에서 매번 `if (url)` 확인을 해야 한다.
 *   그런데 이 함수는 아래에서 없으면 에러를 던져 버리므로,
 *   여기를 통과했다면 contentUrl은 반드시 있다.
 *   그 사실을 타입으로 표현한 것이다.
 *
 *   덕분에 RichTextEditor에서는 이렇게 바로 쓸 수 있다:
 *     editor.chain().setImage({ src: uploaded.contentUrl })
 *   확인 코드가 필요 없다. "검증은 한 곳에서, 그 뒤로는 믿고 쓴다"는 설계다.
 */
export const uploadEditorImage = async (
  imageFile: File,
): Promise<FileUploadResponse & { contentUrl: string }> => {
  const formData = new FormData();
  formData.append("imageFile", imageFile);
  const response = await selectedHttpClient.upload<ApiResponse<FileUploadResponse>>(
    "/files/editor-images",
    formData,
  );

  // ★ 여기서 한 번 확인하고 없으면 에러를 던진다.
  //   주소가 없는데 <img src={undefined}>로 그리면 깨진 이미지가 뜰 뿐
  //   무엇이 잘못됐는지 알 수 없다. 그것보다 여기서 분명하게 실패하는 게 낫다.
  //   (shared/config/applicationEnvironment.ts에서 본 "빨리 실패하기"와 같은 발상)
  if (!response.data.contentUrl) {
    throw new Error("이미지 표시 URL이 응답에 없습니다.");
  }

  // 위 if를 통과했으니 contentUrl이 있다는 걸 우리는 안다.
  // TypeScript는 거기까지 추론하지 못하므로 단언으로 알려 준다.
  return response.data as FileUploadResponse & { contentUrl: string };
};
