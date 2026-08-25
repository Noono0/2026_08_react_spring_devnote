/**
 * ============================================================================
 * DocumentEditorPage.tsx — 【고급】 문서 작성·수정 (프로젝트에서 가장 복잡한 화면)
 * ============================================================================
 *
 * 지금까지 배운 것이 거의 전부 모여 있는 화면이다.
 *   React Hook Form + Zod / TanStack Query / 파일 업로드 / 리치 텍스트 에디터
 *   / 라우팅 / 서버 오류를 폼에 표시하기 / 이탈 방지
 *
 * [하나의 컴포넌트가 두 가지 일을 한다]
 *   /documents/new       → 새로 작성 (isEditMode = false)
 *   /documents/42/edit   → 기존 수정 (isEditMode = true)
 *   주소에 documentId가 있느냐로 구분한다.
 *   폼 구성이 거의 같아서 따로 만들면 중복이 심해진다.
 *
 * [★ 이 페이지에서만 배우는 세 가지]
 *
 *   1. 서버가 보낸 필드 오류를 폼에 다시 붙이기 (setError)
 *      클라이언트 검증(Zod)을 통과해도 서버 규칙에 걸릴 수 있다.
 *      그때 어느 칸이 문제인지 그 칸 아래에 표시해 준다.
 *
 *   2. 낙관적 잠금 (versionNumber)
 *      A와 B가 같은 문서를 동시에 열어 편집할 때
 *      나중에 저장하는 쪽이 앞사람 내용을 덮어쓰는 것을 막는다.
 *
 *   3. 작성 중 이탈 방지 (beforeunload)
 *      쓰던 글이 있는데 창을 닫으려 하면 브라우저가 경고를 띄운다.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { z } from "zod";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { JSONContent } from "@tiptap/core";
import {
  useCreateDocumentMutation,
  useDocumentDetailQuery,
  useUpdateDocumentMutation,
} from "../hooks/useDocumentQueries";
import type { DocumentFormValues, DocumentSaveRequest } from "../types/documentTypes";
import { RichTextEditor } from "../components/RichTextEditor";
import { AttachmentFileUploader } from "@/features/file/components/AttachmentFileUploader";
import { ThumbnailImageUploader } from "@/features/file/components/ThumbnailImageUploader";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";
import type { DocumentAttachment } from "@/features/file/types/fileTypes";

const documentFormSchema = z.object({
  documentTitle: z.string().trim().min(1, "문서 제목은 필수입니다.").max(200),
  documentStatus: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  changeSummary: z.string().max(500).optional(),
});

/**
 * 에디터 본문의 세 가지 형태를 한 덩어리로 묶은 State 타입.
 *
 * ★ 왜 이것만 React Hook Form이 아니라 useState로 관리할까?
 *   Tiptap 에디터는 자기만의 방식으로 내용을 관리하는 독립적인 라이브러리다.
 *   register()로 연결할 수 있는 <input>이 아니다.
 *   그래서 "폼이 다루는 것(제목/상태)"과 "에디터가 다루는 것(본문)"을 나누고,
 *   저장할 때 둘을 합친다. (아래 submitDocument 참고)
 */
interface EditorContentState {
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
}

/**
 * 빈 에디터의 초기 상태.
 *
 * contentJson이 `{ type: "doc", content: [{ type: "paragraph" }] }` 인 이유:
 * Tiptap이 요구하는 "문단 하나짜리 빈 문서" 구조다.
 * 그냥 `{}` 나 null을 넣으면 에디터가 초기화되지 않고 에러가 난다.
 */
const emptyEditorContent: EditorContentState = {
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p></p>",
  contentText: "",
};

const parseDocumentId = (rawDocumentId: string | undefined): number | undefined => {
  if (!rawDocumentId || !/^[1-9]\d*$/.test(rawDocumentId)) {
    return undefined;
  }
  const parsedDocumentId = Number(rawDocumentId);
  return Number.isSafeInteger(parsedDocumentId) ? parsedDocumentId : undefined;
};

export const DocumentEditorPage = () => {
  const routeParameters = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isHistory = location.pathname.startsWith("/history");
  const basePath = isHistory ? "/history" : "/react/documents";
  const documentId = parseDocumentId(routeParameters.documentId);
  const hasInvalidDocumentId = routeParameters.documentId !== undefined && documentId === undefined;
  // 주소에 유효한 documentId가 있으면 "수정 모드"다.
  const isEditMode = routeParameters.documentId !== undefined && documentId !== undefined;

  // 수정 모드일 때만 기존 문서를 불러온다.
  // (훅 안의 enabled 조건 덕분에 새 문서 작성 시에는 요청이 나가지 않는다)
  const documentDetailQuery = useDocumentDetailQuery(documentId, isHistory);

  // ★ 등록용과 수정용 mutation을 둘 다 미리 만들어 둔다.
  //   "수정 모드일 때만 만들자"고 if로 감싸면 안 된다!
  //   훅은 조건문 안에서 호출할 수 없다. 매번 같은 순서로 같은 개수가 실행되어야 한다.
  //   그래서 둘 다 만들고, 저장할 때 필요한 쪽만 쓴다.
  const createDocumentMutation = useCreateDocumentMutation(isHistory);
  // `documentId ?? 0` — 새 문서일 땐 id가 없으므로 0을 넣는다.
  //   어차피 이 mutation은 수정 모드에서만 실행되므로 문제없다.
  const updateDocumentMutation = useUpdateDocumentMutation(documentId ?? 0, isHistory);

  // ── 폼 바깥에서 따로 관리하는 상태들 ────────────────────────────
  const [editorContent, setEditorContent] = useState<EditorContentState>(emptyEditorContent);
  const [thumbnailFileId, setThumbnailFileId] = useState<number | undefined>();
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState<string | undefined>();
  const [attachmentFiles, setAttachmentFiles] = useState<DocumentAttachment[]>([]);

  // ★ "폼 바깥의 것들이 바뀌었나?"를 따로 추적한다.
  //   React Hook Form의 isDirty는 제목/상태/변경요약만 감시한다.
  //   본문이나 파일만 바꾼 경우는 isDirty가 false로 남는다.
  //   그러면 이탈 방지 경고가 안 떠서 작성 중인 글을 날릴 수 있다.
  //   그래서 이 State로 보완한다.
  const [hasAdditionalChanges, setHasAdditionalChanges] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      documentTitle: "",
      documentStatus: "DRAFT",
      changeSummary: "",
    },
  });

  // ── Effect 1: 불러온 문서를 폼에 채워 넣기 ──────────────────────
  //
  // ★ 왜 useEffect가 필요한가?
  //   컴포넌트가 처음 그려질 때는 서버 데이터가 아직 없다(undefined).
  //   그래서 폼은 빈 값으로 시작한다.
  //   잠시 뒤 데이터가 도착하면 그때 폼을 채워야 한다.
  //   "데이터가 도착하는 시점"에 반응하려면 useEffect가 필요하다.
  //
  // ★ 여기서 setValue가 아니라 reset을 쓴 이유
  //   setValue는 값만 바꾸고 "수정됨(isDirty)" 표시를 남긴다.
  //   그러면 사용자가 아무것도 안 건드렸는데 "저장 안 한 변경이 있다"고 경고가 뜬다.
  //   reset은 값을 넣으면서 "이게 새 기준값"이라고 알려 준다. isDirty도 false로 초기화된다.
  useEffect(() => {
    // 아직 데이터가 안 왔으면 아무것도 하지 않는다.
    if (!documentDetailQuery.data) {
      return;
    }
    reset({
      documentTitle: documentDetailQuery.data.documentTitle,
      documentStatus: documentDetailQuery.data.documentStatus,
      // ★ 변경 요약은 일부러 비워 둔다.
      //   이번 수정에서 무엇을 바꿨는지 새로 적어야 하는 칸이다.
      //   지난번 요약이 그대로 남아 있으면 잘못된 이력이 쌓인다.
      changeSummary: "",
    });
    setThumbnailFileId(documentDetailQuery.data.thumbnailFileId);
    setThumbnailImageUrl(documentDetailQuery.data.thumbnailImageUrl);
    setAttachmentFiles(documentDetailQuery.data.attachmentFiles ?? []);
    setEditorContent({
      contentJson: documentDetailQuery.data.contentJson,
      contentHtml: documentDetailQuery.data.contentHtml,
      contentText: documentDetailQuery.data.contentText,
    });
    // ★ 의존성에 reset이 들어 있는 이유
    //   Effect 안에서 쓰는 값은 전부 의존성에 넣는 것이 규칙이다(exhaustive-deps).
    //   reset은 React Hook Form이 안정적으로 유지해 주는 함수라
    //   실제로 이것 때문에 재실행되는 일은 없다.
  }, [documentDetailQuery.data, reset]);

  // ── Effect 2: 작성 중 이탈 방지 ─────────────────────────────────
  //
  // ★ beforeunload는 "탭을 닫거나 새로고침하려 할 때" 브라우저가 부르는 이벤트다.
  //   preventDefault()를 부르면 "정말 나가시겠습니까?" 확인창이 뜬다.
  //
  //   ★ 문구를 우리가 정할 수는 없다.
  //     예전에는 가능했지만, 악성 사이트가 "백신을 설치하세요" 같은 문구로
  //     사용자를 속이는 데 악용해서 브라우저가 막았다.
  //     지금은 브라우저 기본 문구만 나온다.
  //
  //   ★ 이건 브라우저 탭을 닫을 때만 동작한다.
  //     앱 안에서 다른 페이지로 이동하는 건 못 막는다.
  //     (그건 react-router의 useBlocker 같은 별도 기능이 필요하다)
  useEffect(() => {
    const handleBeforeUnload = (beforeUnloadEvent: BeforeUnloadEvent): void => {
      // 폼이 바뀌었거나(isDirty) 본문·파일이 바뀌었으면 경고한다.
      // 아무것도 안 바꿨는데 경고가 뜨면 성가시기만 하므로 조건이 중요하다.
      if (isDirty || hasAdditionalChanges) {
        beforeUnloadEvent.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // ★★ 정리 함수에서 리스너를 반드시 제거해야 한다.
    //   제거하지 않으면 이 페이지를 들락날락할 때마다 리스너가 쌓인다.
    //   그러면 다른 페이지에서도 경고가 뜨고 메모리도 샌다.
    //   "addEventListener를 썼으면 removeEventListener를 짝으로" 기억하자.
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasAdditionalChanges, isDirty]);

  /**
   * ★★ 저장 처리. 이 페이지의 핵심 함수다.
   *
   * Zod 검증을 통과했을 때만 호출된다(handleSubmit이 감싸고 있으므로).
   */
  const submitDocument = async (formValues: DocumentFormValues): Promise<void> => {
    // ── 흩어져 있던 데이터를 하나의 요청 객체로 합친다 ──
    const documentSaveRequest: DocumentSaveRequest = {
      // 폼이 관리하던 값 (제목, 상태, 변경요약)
      ...formValues,
      // 에디터가 관리하던 값 (contentJson, contentHtml, contentText 세 개)
      ...editorContent,
      // 대표 이미지
      thumbnailFileId,
      // ★ 파일 객체 배열에서 id만 뽑아 낸다.
      //   서버는 파일 내용이 아니라 "어떤 파일을 이 문서에 붙일지"만 알면 된다.
      //   업로드는 이미 끝나 있고 여기서는 연결만 하는 것이다.
      attachmentFileIds: attachmentFiles.map((attachmentFile) => attachmentFile.fileId),

      // ★★★ 낙관적 잠금(optimistic locking)의 핵심 세 줄.
      //
      //   `...(조건 ? {값} : {})` 는 "조건이 맞을 때만 이 속성을 추가"하는 관용구다.
      //   조건이 거짓이면 빈 객체를 펼치므로 아무것도 안 붙는다.
      //
      //   수정할 때만 "내가 알고 있는 버전 번호"를 함께 보낸다.
      //   서버는 이렇게 판단한다:
      //     - 보낸 버전 == DB의 현재 버전 → 그 사이 아무도 안 건드렸다 → 저장 OK
      //     - 보낸 버전 != DB의 현재 버전 → 누가 먼저 수정했다 → 409 Conflict로 거부
      //
      //   [이게 없으면 벌어지는 일 — "갱신 손실(lost update)"]
      //     10:00 A가 문서를 연다 (버전 3)
      //     10:01 B가 같은 문서를 연다 (버전 3)
      //     10:05 B가 저장한다 → 버전 4
      //     10:10 A가 저장한다 → B의 수정 내용이 통째로 사라진다!
      //   버전을 확인하면 A의 저장이 거부되고, A는 최신 내용을 확인한 뒤 다시 쓸 수 있다.
      //
      //   ★ 이런 걸 "낙관적"이라고 부르는 이유:
      //     "충돌은 드물 것"이라고 낙관하고 일단 진행한 뒤, 충돌했을 때만 처리한다.
      //     반대로 "비관적 잠금"은 아예 문서를 잠가서 다른 사람이 못 열게 한다.
      //     웹에서는 대부분 낙관적 방식을 쓴다.
      ...(isEditMode && documentDetailQuery.data
        ? { versionNumber: documentDetailQuery.data.versionNumber }
        : {}),
    };

    try {
      // 모드에 따라 알맞은 mutation을 실행한다.
      // mutateAsync를 쓴 이유: 저장이 "성공한 뒤에" 상세 페이지로 이동해야 하기 때문이다.
      const savedDocument = isEditMode
        ? await updateDocumentMutation.mutateAsync(documentSaveRequest)
        : await createDocumentMutation.mutateAsync(documentSaveRequest);

      applicationNotification.success(isEditMode ? "문서를 수정했습니다." : "문서를 등록했습니다.");

      // 방금 저장한 문서의 상세 페이지로 이동한다.
      // ★ 새 문서일 때 서버가 돌려준 documentId를 쓴다는 점이 중요하다.
      //   id는 서버만 알 수 있으므로 응답을 받아야만 이동할 주소를 만들 수 있다.
      navigate(`${basePath}/${savedDocument.documentId}`);
    } catch (requestError) {
      const problemDetails = convertRequestErrorToProblemDetails(requestError);

      // ★★ 서버가 보낸 필드별 오류를 폼의 해당 칸에 붙인다.
      //
      //   왜 필요한가?
      //     "중복된 제목입니다" 같은 규칙은 서버만 판단할 수 있다.
      //     (다른 문서들을 다 봐야 알 수 있으니까)
      //     이런 오류를 화면 구석 알림으로만 띄우면
      //     사용자는 어느 칸이 문제인지 찾아 헤매야 한다.
      //     setError로 그 칸 아래에 빨간 글씨를 붙여 주면 즉시 알 수 있다.
      //
      //   ★ 필드 이름을 화이트리스트로 걸러 내는 게 중요하다.
      //     서버가 폼에 없는 이름을 보낼 수도 있는데(예: "versionNumber"),
      //     그대로 setError하면 아무 데도 안 보이는 오류가 되어 폼이 영영 제출되지 않는다.
      //     우리가 아는 세 칸만 처리한다.
      problemDetails.fieldErrors.forEach((fieldError) => {
        if (["documentTitle", "documentStatus", "changeSummary"].includes(fieldError.fieldName)) {
          setError(fieldError.fieldName as keyof DocumentFormValues, {
            // type: "server" → 클라이언트 검증 오류와 구분하는 표시
            type: "server",
            message: fieldError.message,
          });
        }
      });

      // 전체 오류 알림도 함께 띄운다.
      // 버전 충돌(DOCUMENT_VERSION_CONFLICT)은 특정 칸의 문제가 아니라
      // "다른 사용자가 먼저 수정했습니다"라는 이 알림으로 전달된다.
      applicationNotification.apiError(problemDetails);
    }
  };

  if (hasInvalidDocumentId) {
    return (
      <div className="state-panel error-state" role="alert">
        <h1>잘못된 문서 수정 주소입니다.</h1>
        <p>문서 번호는 1 이상의 숫자여야 합니다.</p>
        <button type="button" onClick={() => navigate(basePath)}>문서 목록으로 이동</button>
      </div>
    );
  }
  if (isEditMode && documentDetailQuery.isPending) {
    return <div className="state-panel">수정할 문서를 불러오는 중입니다.</div>;
  }
  if (isEditMode && documentDetailQuery.isError) {
    const problemDetails = convertRequestErrorToProblemDetails(documentDetailQuery.error);
    return (
      <div className="state-panel error-state" role="alert">
        <h1>수정할 문서를 불러오지 못했습니다.</h1>
        <p>{apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail}</p>
        <button type="button" onClick={() => void documentDetailQuery.refetch()}>다시 시도</button>
      </div>
    );
  }

  return (
    <section>
      <LearningGuideTitle guideId={isHistory ? undefined : "document"}>{isHistory ? (isEditMode ? "업무 History 수정" : "업무 History 작성") : (isEditMode ? "문서 수정" : "새 문서 작성")}</LearningGuideTitle>
      <form className="document-form" onSubmit={(submitEvent) => void handleSubmit(submitDocument)(submitEvent)}>
        <label>
          문서 제목
          <input {...register("documentTitle")} />
          {errors.documentTitle ? <span className="field-error">{errors.documentTitle.message}</span> : null}
        </label>
        <label>
          문서 상태
          <select {...register("documentStatus")}>
            <option value="DRAFT">임시저장</option>
            <option value="PUBLISHED">발행</option>
            <option value="ARCHIVED">보관</option>
          </select>
        </label>
        {isEditMode ? (
          <label>
            변경 요약
            <input {...register("changeSummary")} placeholder="무엇을 변경했는지 입력하세요" />
          </label>
        ) : null}
        <ThumbnailImageUploader
          thumbnailImageUrl={thumbnailImageUrl}
          handleThumbnailChange={(nextThumbnailFileId, nextThumbnailImageUrl) => {
            setThumbnailFileId(nextThumbnailFileId);
            setThumbnailImageUrl(nextThumbnailImageUrl);
            setHasAdditionalChanges(true);
          }}
        />
        {/* 리치 텍스트 에디터.
            부모(이 페이지)와 자식(에디터)이 콜백으로 소통하는 구조를 눈여겨보자.
              initialContent      : 부모 → 자식, 처음 보여줄 내용
              handleContentChange : 자식 → 부모, 내용이 바뀔 때마다 알림
              handleImageUploaded : 자식 → 부모, 이미지를 올렸을 때 알림 */}
        <RichTextEditor
          initialContent={documentDetailQuery.data?.contentJson}
          handleImageUploaded={(uploadedFileId, uploadedImageUrl) => {
            /* 첫 번째 본문 이미지를 대표 이미지로 자동 제안합니다. */
            // ★ 작지만 사용자를 배려한 기능이다.
            //   대표 이미지가 아직 없을 때만 자동으로 채운다.
            //   이미 골라 둔 게 있으면 덮어쓰지 않는다.
            //   "친절한 자동 처리"와 "사용자 선택을 무시하는 참견"의 경계를
            //   이 `if (!thumbnailFileId)` 한 줄이 가른다.
            if (!thumbnailFileId) {
              setThumbnailFileId(uploadedFileId);
              setThumbnailImageUrl(uploadedImageUrl);
              setHasAdditionalChanges(true);
              applicationNotification.success("첫 번째 본문 이미지를 대표 이미지로 설정했습니다.");
            }
          }}
          handleContentChange={(nextEditorContent) => {
            setEditorContent(nextEditorContent);
            setHasAdditionalChanges(true);
          }}
        />
        <AttachmentFileUploader
          attachmentFiles={attachmentFiles}
          handleAttachmentFilesChange={(nextAttachmentFiles) => {
            setAttachmentFiles(nextAttachmentFiles);
            setHasAdditionalChanges(true);
          }}
        />
        <div className="button-row">
          {/* ★ 두 mutation 중 하나라도 진행 중이면 버튼을 잠근다.
                저장 중에 또 누르면 문서가 두 개 등록되거나
                수정 요청이 두 번 나가 버전 충돌이 난다. */}
          <button
            type="submit"
            disabled={createDocumentMutation.isPending || updateDocumentMutation.isPending}
          >
            {isEditMode ? "수정 저장" : "문서 등록"}
          </button>
          {/* navigate(-1) = 브라우저 뒤로가기와 같은 동작.
              특정 주소로 보내지 않고 "왔던 곳으로" 돌려보낸다.
              목록에서 왔으면 목록으로, 상세에서 왔으면 상세로 간다.
              숫자를 -2로 하면 두 단계 뒤로 간다. */}
          <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
            취소
          </button>
        </div>
      </form>
    </section>
  );
};
