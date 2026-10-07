/**
 * ============================================================================
 * HistoryDetailPage.tsx — 업무 History 글 상세 (/history/:documentId)
 * ============================================================================
 *
 * [하는 일]
 *   1. 주소의 글 번호를 정규식으로 검증한다 (/history/바나나 → 잘못된 주소 안내)
 *   2. 로딩 / 오류 / 정상 화면을 early return으로 나눈다
 *   3. 저장된 HTML 본문을 DOMPurify로 정리한 뒤 보여 준다 (XSS 방어)
 *   4. 슈퍼관리자에게만 수정·삭제 버튼을 보여 준다 (서버도 슈퍼관리자가 아니면 403으로 막는다)
 *
 * ※ 14단계 학습용 DocumentDetailPage와 같은 흐름이다.
 *   XSS와 dangerouslySetInnerHTML에 대한 자세한 학습 설명은
 *   practice/14-documents/pages/DocumentDetailPage.tsx에 있다.
 */

import { Link, useNavigate, useParams } from "react-router-dom";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { HistoryTagList } from "../components/HistoryTags";
import { useDeleteHistoryMutation, useHistoryDetailQuery } from "../hooks/useHistoryQueries";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";
import { sanitizeRichTextHtml } from "@/shared/lib/sanitizeRichTextHtml";

const historyListPath = "/history";

/**
 * 주소의 글 번호를 숫자로 바꾼다. 형식이 틀리면 undefined.
 * `/^[1-9]\d*$/` → "1", "42"는 통과 / "0", "007", "1.5", "-3", "abc"는 거부.
 * Number()만 쓰면 ""→0, "0x1A"→26처럼 관대하게 바뀌어 버리므로 형식부터 확인한다.
 */
const parseDocumentId = (rawDocumentId: string | undefined): number | undefined => {
  if (!rawDocumentId || !/^[1-9]\d*$/.test(rawDocumentId)) {
    return undefined;
  }
  const parsedDocumentId = Number(rawDocumentId);
  return Number.isSafeInteger(parsedDocumentId) ? parsedDocumentId : undefined;
};

export const HistoryDetailPage = () => {
  const routeParameters = useParams();
  const navigate = useNavigate();
  const authSessionQuery = useAuthSessionQuery();
  const documentId = parseDocumentId(routeParameters.documentId);
  // 주소에 값은 있는데 형식이 틀린 경우. (값이 아예 없는 경우와 구분한다)
  const hasInvalidDocumentId = routeParameters.documentId !== undefined && documentId === undefined;

  const historyDetailQuery = useHistoryDetailQuery(documentId);
  const deleteHistoryMutation = useDeleteHistoryMutation();

  /** 삭제가 "성공한 뒤에" 목록으로 이동해야 하므로 mutateAsync로 결과를 기다린다. */
  const handleDeleteClick = async (): Promise<void> => {
    if (!documentId || !window.confirm("문서를 삭제하시겠습니까?")) {
      return;
    }
    try {
      await deleteHistoryMutation.mutateAsync(documentId);
      applicationNotification.success("문서를 삭제했습니다.");
      navigate(historyListPath);
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    }
  };

  // ── early return: 모든 훅을 호출한 뒤에만 return할 수 있다(훅 순서 규칙). ──

  // 상태 1: 주소가 잘못됨
  if (hasInvalidDocumentId) {
    return (
      <div className="state-panel error-state" role="alert">
        <h1>잘못된 문서 주소입니다.</h1>
        <p>문서 번호는 1 이상의 숫자여야 합니다.</p>
        <Link to={historyListPath}>문서 목록으로 이동</Link>
      </div>
    );
  }
  // 상태 2: 불러오는 중
  if (historyDetailQuery.isPending) {
    return <div className="state-panel">문서를 불러오는 중입니다.</div>;
  }
  // 상태 3: 오류 또는 데이터 없음 (방문자가 비공개 글 주소로 들어오면 서버가 404를 준다)
  if (historyDetailQuery.isError || !historyDetailQuery.data) {
    const problemDetails = convertRequestErrorToProblemDetails(historyDetailQuery.error);
    const userMessage = apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail;
    return (
      <div className="state-panel error-state" role="alert">
        <h1>문서를 불러오지 못했습니다.</h1>
        <p>{userMessage}</p>
        <button type="button" onClick={() => void historyDetailQuery.refetch()}>다시 시도</button>
      </div>
    );
  }

  // 상태 4: 정상. (변수 이름을 document로 지으면 브라우저 전역 document를 가리므로 historyDocument로 지었다)
  const historyDocument = historyDetailQuery.data;
  return (
    <article className="document-detail">
      <div className="page-heading-row">
        <div>
          <div className="page-title-with-guide"><h1>{historyDocument.documentTitle}</h1><FeatureHelpButton topic="history" /></div>
          <p>
            {historyDocument.authorName} · 버전 {historyDocument.versionNumber} · {historyDocument.documentStatus}
          </p>
          <HistoryTagList tags={historyDocument.tags} basePath={historyListPath} />
        </div>
        {authSessionQuery.data?.superAdministrator ? (
          <div className="button-row">
            <Link className="secondary-link" to={`${historyListPath}/${historyDocument.documentId}/edit`}>
              수정
            </Link>
            <button
              className="danger-button"
              onClick={() => void handleDeleteClick()}
              disabled={deleteHistoryMutation.isPending}
            >
              삭제
            </button>
          </div>
        ) : null}
      </div>
      {historyDocument.thumbnailImageUrl ? (
        <div className="document-detail-thumbnail">
          <img src={historyDocument.thumbnailImageUrl} alt={`${historyDocument.documentTitle} 대표 이미지`} />
        </div>
      ) : null}
      {/* ★ 에디터로 쓴 HTML을 그대로 보여 줘야 해서 dangerouslySetInnerHTML을 쓴다.
            반드시 sanitizeRichTextHtml(DOMPurify)로 <script>·onerror 같은 위험한 부분을 지운 뒤 넣는다. */}
      <div
        className="rendered-document-content"
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(historyDocument.contentHtml) }}
      />
      {historyDocument.attachmentFiles.length > 0 ? (
        <section className="document-attachment-section">
          <h2>첨부파일</h2>
          <ul className="attachment-file-list">
            {historyDocument.attachmentFiles.map((attachmentFile) => (
              <li key={attachmentFile.fileId}>
                <div>
                  <strong>{attachmentFile.originalFileName}</strong>
                  <small>{Math.ceil(attachmentFile.fileSize / 1024).toLocaleString()} KB</small>
                </div>
                {/* 파일 다운로드는 서버 주소로 이동해야 하므로 <Link>가 아니라 <a>를 쓴다. */}
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
