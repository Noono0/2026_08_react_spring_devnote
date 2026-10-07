/**
 * ============================================================================
 * HistoryEditorPage.tsx — 업무 History 작성·수정 (/history/new, /history/:documentId/edit)
 * ============================================================================
 *
 * 슈퍼관리자 전용 화면이다. App.tsx에서 RoleProtectedRoute(superAdminOnly)로 감싸고,
 * 서버(HistoryController)도 슈퍼관리자가 아니면 403으로 거부한다.
 *
 * [하는 일]
 *   - 제목·상태·태그·변경 요약: React Hook Form + Zod로 검증
 *   - 본문: 공통 리치 텍스트 에디터(features/rich-text-editor)가 관리
 *   - 대표 이미지·첨부파일: 파일 기능(features/file)의 업로더 재사용
 *   - 수정 시 versionNumber를 함께 보내 다른 곳에서 먼저 고친 내용을 덮어쓰지 않게 한다(낙관적 잠금)
 *   - 서버가 보낸 필드 오류를 해당 입력칸 아래에 붙인다(setError)
 *   - 저장하지 않은 변경이 있으면 탭을 닫을 때 경고한다(beforeunload)
 *
 * ※ 14단계 학습용 DocumentEditorPage와 같은 흐름이다. 각 개념의 자세한 학습 설명은
 *   practice/14-documents/pages/DocumentEditorPage.tsx에 있다.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useParams } from "react-router-dom";
import type { JSONContent } from "@tiptap/core";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";
import {
  useCreateHistoryMutation,
  useHistoryDetailQuery,
  useUpdateHistoryMutation,
} from "../hooks/useHistoryQueries";
import type { HistoryFormValues, HistorySaveRequest } from "../types/historyTypes";
import { RichTextEditor } from "@/features/rich-text-editor/components/RichTextEditor";
import { AttachmentFileUploader } from "@/features/file/components/AttachmentFileUploader";
import { ThumbnailImageUploader } from "@/features/file/components/ThumbnailImageUploader";
import type { DocumentAttachment } from "@/features/file/types/fileTypes";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";
import { parseCommaSeparatedValues } from "@/shared/lib/parseCommaSeparatedValues";

const historyListPath = "/history";

// 서버 DTO(DocumentCreateRequest·DocumentUpdateRequest)의 검증 규칙과 같은 한도를 화면에서도 먼저 검사한다.
const historyFormSchema = z.object({
  documentTitle: z.string().trim().min(1, "문서 제목은 필수입니다.").max(200),
  documentStatus: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  changeSummary: z.string().max(500).optional(),
  // 태그는 "배포, Nginx"처럼 쉼표로 구분한 한 칸으로 받고, 저장할 때 배열로 바꾼다.
  tagText: z.string().max(300, "태그 입력은 300자 이하여야 합니다.").optional(),
});

// 서버 필드 오류 중 이 폼에 실제로 있는 칸 이름(허용 목록). 없는 이름으로 setError하면 보이지 않는 오류가 남는다.
const formFieldNames: (keyof HistoryFormValues)[] = ["documentTitle", "documentStatus", "changeSummary"];

/** 에디터 본문의 세 가지 형태. Tiptap은 <input>이 아니라서 폼이 아니라 useState로 관리한다. */
interface EditorContentState {
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
}

// Tiptap이 요구하는 "빈 문단 하나짜리 문서" 구조. {}나 null을 넣으면 에디터가 초기화되지 않는다.
const emptyEditorContent: EditorContentState = {
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  contentHtml: "<p></p>",
  contentText: "",
};

/** 주소의 글 번호 검증. "1", "42"만 통과하고 "0", "007", "abc"는 undefined. */
const parseDocumentId = (rawDocumentId: string | undefined): number | undefined => {
  if (!rawDocumentId || !/^[1-9]\d*$/.test(rawDocumentId)) {
    return undefined;
  }
  const parsedDocumentId = Number(rawDocumentId);
  return Number.isSafeInteger(parsedDocumentId) ? parsedDocumentId : undefined;
};

export const HistoryEditorPage = () => {
  const routeParameters = useParams();
  const navigate = useNavigate();
  const documentId = parseDocumentId(routeParameters.documentId);
  const hasInvalidDocumentId = routeParameters.documentId !== undefined && documentId === undefined;
  // 주소에 올바른 글 번호가 있으면 수정 모드, 없으면 새 글 작성 모드다.
  const isEditMode = routeParameters.documentId !== undefined && documentId !== undefined;

  // 수정 모드일 때만 기존 글을 불러온다(훅 안의 enabled 조건).
  const historyDetailQuery = useHistoryDetailQuery(documentId);
  // 훅은 조건문 안에서 부를 수 없으므로 등록·수정 mutation을 둘 다 만들고, 저장할 때 필요한 쪽만 쓴다.
  const createHistoryMutation = useCreateHistoryMutation();
  const updateHistoryMutation = useUpdateHistoryMutation(documentId ?? 0);

  // ── 폼 바깥에서 따로 관리하는 상태들 ──
  const [editorContent, setEditorContent] = useState<EditorContentState>(emptyEditorContent);
  const [thumbnailFileId, setThumbnailFileId] = useState<number | undefined>();
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState<string | undefined>();
  const [attachmentFiles, setAttachmentFiles] = useState<DocumentAttachment[]>([]);
  // 본문·파일만 바꾼 경우는 폼의 isDirty가 모르므로 이 값으로 이탈 경고를 보완한다.
  const [hasAdditionalChanges, setHasAdditionalChanges] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<HistoryFormValues>({
    resolver: zodResolver(historyFormSchema),
    defaultValues: {
      documentTitle: "",
      documentStatus: "DRAFT",
      changeSummary: "",
      tagText: "",
    },
  });

  // 불러온 글을 폼에 채운다. setValue가 아니라 reset을 써야 "수정됨(isDirty)" 표시가 남지 않는다.
  useEffect(() => {
    if (!historyDetailQuery.data) {
      return;
    }
    reset({
      documentTitle: historyDetailQuery.data.documentTitle,
      documentStatus: historyDetailQuery.data.documentStatus,
      // 변경 요약은 이번 수정 내용을 새로 적는 칸이라 비워 둔다.
      changeSummary: "",
      tagText: historyDetailQuery.data.tags.join(", "),
    });
    setThumbnailFileId(historyDetailQuery.data.thumbnailFileId);
    setThumbnailImageUrl(historyDetailQuery.data.thumbnailImageUrl);
    setAttachmentFiles(historyDetailQuery.data.attachmentFiles ?? []);
    setEditorContent({
      contentJson: historyDetailQuery.data.contentJson,
      contentHtml: historyDetailQuery.data.contentHtml,
      contentText: historyDetailQuery.data.contentText,
    });
  }, [historyDetailQuery.data, reset]);

  // 저장하지 않은 변경이 있을 때 탭을 닫거나 새로고침하면 브라우저가 경고하게 한다.
  useEffect(() => {
    const handleBeforeUnload = (beforeUnloadEvent: BeforeUnloadEvent): void => {
      if (isDirty || hasAdditionalChanges) {
        beforeUnloadEvent.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    // 정리 함수에서 리스너를 지우지 않으면 화면을 오갈 때마다 리스너가 쌓인다.
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasAdditionalChanges, isDirty]);

  /** 저장. Zod 검증을 통과했을 때만 handleSubmit이 이 함수를 부른다. */
  const submitHistory = async (formValues: HistoryFormValues): Promise<void> => {
    // 태그 입력칸(tagText)은 서버가 받는 모양이 아니므로 꺼내서 tags 배열로 바꾼다.
    const { tagText, ...historyFormValues } = formValues;
    const historySaveRequest: HistorySaveRequest = {
      ...historyFormValues,
      tags: parseCommaSeparatedValues(tagText ?? "", { stripLeadingHash: true }),
      ...editorContent,
      thumbnailFileId,
      // 업로드는 이미 끝났고, 여기서는 이 글에 붙일 파일 번호만 보낸다.
      attachmentFileIds: attachmentFiles.map((attachmentFile) => attachmentFile.fileId),
      // 수정할 때만 "내가 알고 있는 버전"을 보낸다. 서버 버전과 다르면 409로 거부된다(낙관적 잠금).
      ...(isEditMode && historyDetailQuery.data
        ? { versionNumber: historyDetailQuery.data.versionNumber }
        : {}),
    };

    try {
      // 저장이 성공한 뒤에 상세로 이동해야 하므로 mutateAsync로 기다린다.
      const savedHistory = isEditMode
        ? await updateHistoryMutation.mutateAsync(historySaveRequest)
        : await createHistoryMutation.mutateAsync(historySaveRequest);
      applicationNotification.success(isEditMode ? "문서를 수정했습니다." : "문서를 등록했습니다.");
      // 새 글의 번호는 서버만 알기 때문에 응답의 documentId로 이동할 주소를 만든다.
      navigate(`${historyListPath}/${savedHistory.documentId}`);
    } catch (requestError) {
      const problemDetails = convertRequestErrorToProblemDetails(requestError);
      // 서버가 보낸 필드별 오류를 해당 입력칸 아래에 붙인다.
      problemDetails.fieldErrors.forEach((fieldError) => {
        // 태그 오류는 "tags" 또는 "tags[2]"로 오지만 화면에는 태그 입력칸 하나뿐이다.
        if (fieldError.fieldName === "tags" || fieldError.fieldName.startsWith("tags[")) {
          setError("tagText", { type: "server", message: fieldError.message });
          return;
        }
        const formFieldName = formFieldNames.find((fieldName) => fieldName === fieldError.fieldName);
        if (formFieldName) {
          setError(formFieldName, { type: "server", message: fieldError.message });
        }
      });
      // 버전 충돌처럼 특정 칸의 문제가 아닌 오류는 이 알림으로 전달된다.
      applicationNotification.apiError(problemDetails);
    }
  };

  if (hasInvalidDocumentId) {
    return (
      <div className="state-panel error-state" role="alert">
        <h1>잘못된 문서 수정 주소입니다.</h1>
        <p>문서 번호는 1 이상의 숫자여야 합니다.</p>
        <button type="button" onClick={() => navigate(historyListPath)}>문서 목록으로 이동</button>
      </div>
    );
  }
  if (isEditMode && historyDetailQuery.isPending) {
    return <div className="state-panel">수정할 문서를 불러오는 중입니다.</div>;
  }
  if (isEditMode && historyDetailQuery.isError) {
    const problemDetails = convertRequestErrorToProblemDetails(historyDetailQuery.error);
    return (
      <div className="state-panel error-state" role="alert">
        <h1>수정할 문서를 불러오지 못했습니다.</h1>
        <p>{apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail}</p>
        <button type="button" onClick={() => void historyDetailQuery.refetch()}>다시 시도</button>
      </div>
    );
  }

  return (
    <section>
      <div className="page-title-with-guide"><h1>{isEditMode ? "업무 History 수정" : "업무 History 작성"}</h1><FeatureHelpButton topic="history" /></div>
      <form className="document-form" onSubmit={(submitEvent) => void handleSubmit(submitHistory)(submitEvent)}>
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
        <label>
          태그 <small>쉼표로 구분 · 최대 10개 · 예: 배포, Nginx, 트러블슈팅</small>
          <input {...register("tagText")} placeholder="배포, Nginx" />
          {errors.tagText ? <span className="field-error">{errors.tagText.message}</span> : null}
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
        <RichTextEditor
          initialContent={historyDetailQuery.data?.contentJson}
          handleImageUploaded={(uploadedFileId, uploadedImageUrl) => {
            // 대표 이미지가 아직 없을 때만 첫 본문 이미지를 대표 이미지로 제안한다(이미 고른 것은 덮어쓰지 않는다).
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
          {/* 저장 중에 다시 누르면 글이 두 번 등록되거나 버전 충돌이 나므로 잠근다. */}
          <button
            type="submit"
            disabled={createHistoryMutation.isPending || updateHistoryMutation.isPending}
          >
            {isEditMode ? "수정 저장" : "문서 등록"}
          </button>
          {/* navigate(-1) = 브라우저 뒤로가기. 목록에서 왔으면 목록으로, 상세에서 왔으면 상세로 돌아간다. */}
          <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
            취소
          </button>
        </div>
      </form>
    </section>
  );
};
