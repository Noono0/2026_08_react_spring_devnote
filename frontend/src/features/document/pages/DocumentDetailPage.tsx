import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { useDeleteDocumentMutation, useDocumentDetailQuery } from "../hooks/useDocumentQueries";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";

const parseDocumentId = (rawDocumentId: string | undefined): number | undefined => {
  if (!rawDocumentId || !/^[1-9]\d*$/.test(rawDocumentId)) {
    return undefined;
  }
  const parsedDocumentId = Number(rawDocumentId);
  return Number.isSafeInteger(parsedDocumentId) ? parsedDocumentId : undefined;
};

export const DocumentDetailPage = () => {
  const routeParameters = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const authSessionQuery = useAuthSessionQuery();
  const isHistory = location.pathname.startsWith("/history");
  const basePath = isHistory ? "/history" : "/react/documents";
  const documentId = parseDocumentId(routeParameters.documentId);
  const hasInvalidDocumentId = routeParameters.documentId !== undefined && documentId === undefined;
  const documentDetailQuery = useDocumentDetailQuery(documentId, isHistory);
  const deleteDocumentMutation = useDeleteDocumentMutation(isHistory);

  const handleDeleteClick = async (): Promise<void> => {
    if (!documentId || !window.confirm("문서를 삭제하시겠습니까?")) {
      return;
    }
    try {
      await deleteDocumentMutation.mutateAsync(documentId);
      applicationNotification.success("문서를 삭제했습니다.");
      navigate(basePath);
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    }
  };

  if (hasInvalidDocumentId) {
    return (
      <div className="state-panel error-state" role="alert">
        <h1>잘못된 문서 주소입니다.</h1>
        <p>문서 번호는 1 이상의 숫자여야 합니다.</p>
        <Link to={basePath}>문서 목록으로 이동</Link>
      </div>
    );
  }
  if (documentDetailQuery.isPending) {
    return <div className="state-panel">문서를 불러오는 중입니다.</div>;
  }
  if (documentDetailQuery.isError || !documentDetailQuery.data) {
    const problemDetails = convertRequestErrorToProblemDetails(documentDetailQuery.error);
    const userMessage = apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail;
    return (
      <div className="state-panel error-state" role="alert">
        <h1>문서를 불러오지 못했습니다.</h1>
        <p>{userMessage}</p>
        <button type="button" onClick={() => void documentDetailQuery.refetch()}>다시 시도</button>
      </div>
    );
  }

  const document = documentDetailQuery.data;
  return (
    <article className="document-detail">
      <div className="page-heading-row">
        <div>
          <h1>{document.documentTitle}</h1>
          <p>
            {document.authorName} · 버전 {document.versionNumber} · {document.documentStatus}
          </p>
        </div>
        {!isHistory || authSessionQuery.data?.superAdministrator ? <div className="button-row">
          <Link className="secondary-link" to={`${basePath}/${document.documentId}/edit`}>
            수정
          </Link>
          <button
            className="danger-button"
            onClick={() => void handleDeleteClick()}
            disabled={deleteDocumentMutation.isPending}
          >
            삭제
          </button>
        </div> : null}
      </div>
      {document.thumbnailImageUrl ? (
        <div className="document-detail-thumbnail">
          <img src={document.thumbnailImageUrl} alt={`${document.documentTitle} 대표 이미지`} />
        </div>
      ) : null}
      <div
        className="rendered-document-content"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(document.contentHtml) }}
      />
      {document.attachmentFiles.length > 0 ? (
        <section className="document-attachment-section">
          <h2>첨부파일</h2>
          <ul className="attachment-file-list">
            {document.attachmentFiles.map((attachmentFile) => (
              <li key={attachmentFile.fileId}>
                <div>
                  <strong>{attachmentFile.originalFileName}</strong>
                  <small>{Math.ceil(attachmentFile.fileSize / 1024).toLocaleString()} KB</small>
                </div>
                <a href={attachmentFile.downloadUrl}>다운로드</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="security-note">
        DOMPurify로 저장된 HTML을 정리한 뒤 화면에 출력합니다. 백엔드도 이미지 파일 시그니처와 안전한 MIME 타입을 검증합니다.
      </p>
    </article>
  );
};
