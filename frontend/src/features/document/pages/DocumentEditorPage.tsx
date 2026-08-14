import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

interface EditorContentState {
  contentJson: JSONContent;
  contentHtml: string;
  contentText: string;
}

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
  const isEditMode = routeParameters.documentId !== undefined && documentId !== undefined;
  const documentDetailQuery = useDocumentDetailQuery(documentId, isHistory);
  const createDocumentMutation = useCreateDocumentMutation(isHistory);
  const updateDocumentMutation = useUpdateDocumentMutation(documentId ?? 0, isHistory);
  const [editorContent, setEditorContent] = useState<EditorContentState>(emptyEditorContent);
  const [thumbnailFileId, setThumbnailFileId] = useState<number | undefined>();
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState<string | undefined>();
  const [attachmentFiles, setAttachmentFiles] = useState<DocumentAttachment[]>([]);
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

  useEffect(() => {
    if (!documentDetailQuery.data) {
      return;
    }
    reset({
      documentTitle: documentDetailQuery.data.documentTitle,
      documentStatus: documentDetailQuery.data.documentStatus,
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
  }, [documentDetailQuery.data, reset]);

  useEffect(() => {
    const handleBeforeUnload = (beforeUnloadEvent: BeforeUnloadEvent): void => {
      if (isDirty || hasAdditionalChanges) {
        beforeUnloadEvent.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasAdditionalChanges, isDirty]);

  const submitDocument = async (formValues: DocumentFormValues): Promise<void> => {
    const documentSaveRequest: DocumentSaveRequest = {
      ...formValues,
      ...editorContent,
      thumbnailFileId,
      attachmentFileIds: attachmentFiles.map((attachmentFile) => attachmentFile.fileId),
      ...(isEditMode && documentDetailQuery.data
        ? { versionNumber: documentDetailQuery.data.versionNumber }
        : {}),
    };

    try {
      const savedDocument = isEditMode
        ? await updateDocumentMutation.mutateAsync(documentSaveRequest)
        : await createDocumentMutation.mutateAsync(documentSaveRequest);
      applicationNotification.success(isEditMode ? "문서를 수정했습니다." : "문서를 등록했습니다.");
      navigate(`${basePath}/${savedDocument.documentId}`);
    } catch (requestError) {
      const problemDetails = convertRequestErrorToProblemDetails(requestError);
      problemDetails.fieldErrors.forEach((fieldError) => {
        if (["documentTitle", "documentStatus", "changeSummary"].includes(fieldError.fieldName)) {
          setError(fieldError.fieldName as keyof DocumentFormValues, {
            type: "server",
            message: fieldError.message,
          });
        }
      });
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
      <h1>{isHistory ? (isEditMode ? "업무 History 수정" : "업무 History 작성") : (isEditMode ? "문서 수정" : "새 문서 작성")}</h1>
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
        <RichTextEditor
          initialContent={documentDetailQuery.data?.contentJson}
          handleImageUploaded={(uploadedFileId, uploadedImageUrl) => {
            /* 첫 번째 본문 이미지를 대표 이미지로 자동 제안합니다. */
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
          <button
            type="submit"
            disabled={createDocumentMutation.isPending || updateDocumentMutation.isPending}
          >
            {isEditMode ? "수정 저장" : "문서 등록"}
          </button>
          <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
            취소
          </button>
        </div>
      </form>
    </section>
  );
};
