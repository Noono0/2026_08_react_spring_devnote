/**
 * ============================================================================
 * DocumentListPage.tsx — 【고급】 URL을 상태로 쓰는 검색 목록
 * ============================================================================
 *
 * ★★ 이 페이지의 가장 큰 배울 점: "검색 조건을 useState가 아니라 URL에 둔다"
 *
 * [useState에 두면 생기는 문제들]
 *   - 검색 결과를 친구에게 링크로 보낼 수 없다 (주소가 늘 똑같으니까)
 *   - 새로고침하면 검색 조건이 전부 사라진다
 *   - 상세 페이지에 들어갔다 뒤로 가면 검색 조건이 초기화된다
 *   - 즐겨찾기에 "특정 조건의 목록"을 저장할 수 없다
 *
 * [URL에 두면]
 *   /react/documents?searchKeyword=리액트&pageNumber=2&sortProperty=VIEW_COUNT
 *   이 주소 하나에 화면 상태가 전부 담긴다.
 *   공유, 새로고침, 뒤로가기, 즐겨찾기가 전부 공짜로 해결된다.
 *
 *   ★ 판단 기준: "이 상태를 URL로 공유했을 때 의미가 있는가?"
 *     검색 조건, 페이지 번호, 정렬, 필터 → URL이 맞다
 *     모달 열림 여부, 입력 중인 글자     → useState가 맞다
 *
 * [URL을 쓸 때 반드시 따라오는 책임 — 검증]
 *   URL은 사용자가 직접 고칠 수 있다. ?pageNumber=바나나 도 가능하다.
 *   그래서 읽을 때마다 "우리가 아는 값인지" 확인해야 한다.
 *   이 파일 위쪽 절반이 그 검증 코드인 이유다.
 *
 * [이 페이지가 다루는 화면 상태 네 가지]
 *   로딩(스켈레톤) / 오류(재시도 버튼) / 빈 결과 / 정상 목록
 *   전부 빠짐없이 처리한 좋은 예시이니 눈여겨보자.
 */

import { Link, useLocation, useSearchParams } from "react-router-dom";
import { LearningGuideTitle } from "@/features/learning/components/LearningGuideTitle";
import { useDocumentListQuery } from "../hooks/useDocumentQueries";
import type { DocumentSearchCondition } from "../types/documentTypes";
import { DocumentSearchForm } from "../components/DocumentSearchForm";
import { DocumentPagination } from "../components/DocumentPagination";
import { DocumentThumbnailCard } from "../components/DocumentThumbnailCard";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";

export type DocumentListViewMode = "table" | "thumbnail";

// ── 허용된 값 목록 ────────────────────────────────────────────────
//
// ★ `DocumentSearchCondition["searchType"][]` 이라는 타입 표기를 보자.
//   대괄호로 타입 안의 속성 타입을 꺼내고, 뒤의 []로 배열을 만든 것이다.
//   결과: ("TITLE" | "CONTENT" | "TITLE_CONTENT" | "AUTHOR")[]
//
//   왜 이렇게 쓸까? 타입 정의를 바꾸면 이 배열의 타입도 자동으로 따라온다.
//   목록에 값을 하나 빠뜨리거나 오타를 내면 TypeScript가 바로 알려 준다.
const searchTypeValues: DocumentSearchCondition["searchType"][] = [
  "TITLE",
  "CONTENT",
  "TITLE_CONTENT",
  "AUTHOR",
];
// `NonNullable<T>` = T에서 null과 undefined를 뺀 타입.
// documentStatus는 `?`가 붙어 optional이라 undefined가 포함돼 있는데,
// "허용 값 목록"에 undefined가 들어가면 곤란하므로 걸러 낸 것이다.
const documentStatusValues: NonNullable<DocumentSearchCondition["documentStatus"]>[] = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
];
const sortPropertyValues: DocumentSearchCondition["sortProperty"][] = [
  "CREATED_AT",
  "UPDATED_AT",
  "VIEW_COUNT",
  "TITLE",
];
const sortDirectionValues: DocumentSearchCondition["sortDirection"][] = ["ASC", "DESC"];

/**
 * ★ URL에서 "정해진 값 중 하나"를 안전하게 꺼낸다.
 *
 * [제네릭 함수 문법 읽기]
 *   `<EnumValue extends string>` = "문자열 계열의 타입 하나를 빈칸으로 받겠다"
 *   호출할 때 실제 타입이 정해지고, 반환 타입도 그에 맞춰진다.
 *   덕분에 searchType용, sortProperty용을 따로 만들지 않고 하나로 쓸 수 있다.
 *
 * [하는 일]
 *   URL에서 값을 꺼내 → 허용 목록에 있는지 확인 → 있으면 그 값, 없으면 기본값.
 *
 * ★ 이 함수가 없으면 어떤 일이 벌어지나?
 *   누가 ?sortProperty=DROP_TABLE 같은 값을 넣어도 그대로 서버에 전달된다.
 *   서버가 500 오류를 내거나, 최악의 경우 예상 못 한 동작을 할 수 있다.
 *   "허용 목록(allowlist) 방식"으로 걸러 내는 것이 가장 안전한 검증법이다.
 *   (금지 목록을 만드는 방식은 항상 빠뜨리는 게 생긴다)
 */
const getEnumSearchParameter = <EnumValue extends string>(
  searchParameters: URLSearchParams,
  parameterName: string,
  // readonly를 붙이면 이 함수 안에서 배열을 실수로 고칠 수 없다.
  allowedValues: readonly EnumValue[],
  fallbackValue: EnumValue,
): EnumValue => {
  // URL에 없는 값이면 null이 온다.
  const parameterValue = searchParameters.get(parameterName);
  return parameterValue && allowedValues.includes(parameterValue as EnumValue)
    ? (parameterValue as EnumValue)
    : fallbackValue;
};

/**
 * ★ URL에서 숫자를 안전하게 꺼낸다. 범위 검사까지 한다.
 *
 * 방어해야 할 입력들:
 *   ?pageSize=바나나   → Number("바나나")는 NaN
 *   ?pageSize=1.5     → 정수가 아니다
 *   ?pageSize=999999  → 한 번에 백만 건을 요청하면 서버가 죽는다
 *   ?pageNumber=-5    → 음수 페이지는 없다
 *   값이 없으면        → Number(null)은 0이 된다 (헷갈리는 부분!)
 */
const getIntegerSearchParameter = (
  searchParameters: URLSearchParams,
  parameterName: string,
  fallbackValue: number,
  minimumValue: number,
  maximumValue: number,
): number => {
  const parameterValue = Number(searchParameters.get(parameterName));

  // ★ Number.isSafeInteger가 세 가지를 한 번에 걸러 준다.
  //   NaN(숫자로 못 바꾼 값), 소수, 너무 큰 수.
  //   `typeof === "number"` 로는 NaN을 못 걸러 낸다. (NaN의 타입도 number다)
  //
  // 그 뒤 min/max로 상식적인 범위인지 확인한다.
  // 하나라도 어긋나면 조용히 기본값을 쓴다.
  // ★ 오류를 던지지 않는 게 포인트다. 주소가 이상하다고 화면을 못 보여 주는 것보다
  //   기본값으로 정상 동작하는 게 사용자에게 낫다.
  return Number.isSafeInteger(parameterValue)
    && parameterValue >= minimumValue
    && parameterValue <= maximumValue
    ? parameterValue
    : fallbackValue;
};

/**
 * ★ URL 전체를 검색 조건 객체로 변환한다.
 *
 * 이 함수 하나가 "URL이라는 문자열"과 "타입이 보장된 객체" 사이의 경계다.
 * 여기를 통과하면 아래 모든 코드는 값이 올바르다고 믿고 쓸 수 있다.
 * 이런 지점을 "신뢰 경계(trust boundary)"라고 부른다.
 */
const getSearchConditionFromUrl = (searchParameters: URLSearchParams): DocumentSearchCondition => {
  // documentStatus만 따로 처리하는 이유:
  // 다른 값들은 "없으면 기본값"이지만, 이건 "없으면 undefined(전체 상태)"여야 한다.
  // 그래서 공통 함수를 못 쓰고 직접 검사한다.
  const rawDocumentStatus = searchParameters.get("documentStatus");
  const documentStatus = rawDocumentStatus
    && documentStatusValues.includes(rawDocumentStatus as NonNullable<DocumentSearchCondition["documentStatus"]>)
    ? (rawDocumentStatus as NonNullable<DocumentSearchCondition["documentStatus"]>)
    : undefined;

  return {
    searchKeyword: searchParameters.get("searchKeyword") ?? "",
    searchType: getEnumSearchParameter(
      searchParameters,
      "searchType",
      searchTypeValues,
      "TITLE_CONTENT",
    ),
    documentStatus,
    // ★ 페이지 번호가 0부터 시작한다는 점에 주의!
    //   백엔드가 페이지를 0부터 세기 때문에 맞춘 것이다.
    //   (backend/.../document/dto/PageResponse.java 에서 firstPage를
    //    `pageNumber == 0` 으로 계산하는 걸 직접 확인할 수 있다)
    //   사용자에게 보여줄 때는 +1 해서 1페이지부터 표시한다.
    //   (DocumentPagination.tsx에서 그 변환을 볼 수 있다)
    pageNumber: getIntegerSearchParameter(searchParameters, "pageNumber", 0, 0, 1_000_000),
    // 한 페이지 최대 100건으로 제한한다.
    // 이 상한이 없으면 ?pageSize=999999 로 서버를 마비시킬 수 있다.
    pageSize: getIntegerSearchParameter(searchParameters, "pageSize", 10, 1, 100),
    sortProperty: getEnumSearchParameter(
      searchParameters,
      "sortProperty",
      sortPropertyValues,
      "UPDATED_AT",
    ),
    sortDirection: getEnumSearchParameter(
      searchParameters,
      "sortDirection",
      sortDirectionValues,
      "DESC",
    ),
  };
};

const getViewModeFromUrl = (searchParameters: URLSearchParams): DocumentListViewMode =>
  searchParameters.get("viewMode") === "thumbnail" ? "thumbnail" : "table";

export const DocumentListPage = () => {
  // ★★ useSearchParams — useState와 사용법이 아주 비슷하다.
  //   const [값, 바꾸는함수] = useState(...)
  //   const [쿼리, 쿼리바꾸는함수] = useSearchParams()
  //
  //   차이는 값이 저장되는 곳이다. State는 메모리, 이건 주소창이다.
  //   setSearchParameters를 부르면 주소가 바뀌고 컴포넌트가 다시 그려진다.
  const [searchParameters, setSearchParameters] = useSearchParams();

  const location = useLocation();
  const authSessionQuery = useAuthSessionQuery();

  // 같은 컴포넌트가 두 주소에서 재사용된다. 지금 어느 쪽인지 판단한다.
  const isHistory = location.pathname.startsWith("/history");
  const basePath = isHistory ? "/history" : "/react/documents";

  // URL → 검증된 검색 조건 객체.
  const parsedSearchCondition = getSearchConditionFromUrl(searchParameters);

  // ★ 권한에 따라 조건을 강제로 덮어쓴다.
  //   History(포트폴리오)는 일반 방문자에게 공개된 글만 보여야 한다.
  //   최고 관리자가 아니면 documentStatus를 PUBLISHED로 고정한다.
  //   그러면 ?documentStatus=DRAFT 로 주소를 고쳐도 임시글이 보이지 않는다.
  //
  //   ★ 물론 이것도 "화면 편의"일 뿐이다. 최종 차단은 서버가 해야 한다.
  //   `as const`를 붙인 이유: 그냥 두면 타입이 string으로 넓어져
  //   DocumentStatus 자리에 못 들어간다.
  const searchCondition = isHistory && !authSessionQuery.data?.superAdministrator
    ? { ...parsedSearchCondition, documentStatus: "PUBLISHED" as const }
    : parsedSearchCondition;

  const viewMode = getViewModeFromUrl(searchParameters);

  // ★ 조건 객체를 그대로 훅에 넘긴다.
  //   이 객체가 queryKey에 들어가므로, 검색어나 페이지가 바뀌면
  //   키가 달라져 자동으로 새 데이터를 불러온다.
  //   "언제 다시 요청할까"를 우리가 신경 쓸 필요가 없다.
  const documentListQuery = useDocumentListQuery(searchCondition, isHistory);

  /**
   * 검색 조건을 바꾼다 = 주소를 바꾼다.
   *
   * ★ setState가 아니라 setSearchParameters를 부르는 게 핵심이다.
   *   주소가 바뀌면 → 컴포넌트가 다시 그려지고 → URL을 다시 읽고
   *   → queryKey가 바뀌고 → 새 데이터를 불러온다.
   *   이 흐름이 자동으로 이어진다.
   */
  const updateSearchCondition = (nextCondition: DocumentSearchCondition): void => {
    // ★ 기존 파라미터를 물려받지 않고 "빈 것부터" 새로 만든다.
    //   그래야 이전 검색의 찌꺼기(예: 지운 조건)가 주소에 남지 않는다.
    const nextSearchParameters = new URLSearchParams();

    Object.entries(nextCondition).forEach(([parameterName, parameterValue]) => {
      // 빈 값은 주소에 넣지 않는다.
      // "?searchKeyword=&documentStatus=" 처럼 지저분해지는 걸 막고,
      // 주소가 짧아져 공유하기도 좋다.
      if (parameterValue !== undefined && parameterValue !== "") {
        nextSearchParameters.set(parameterName, String(parameterValue));
      }
    });

    // 보기 방식은 검색 조건이 아니지만 URL에는 유지해야 하므로 따로 넣어 준다.
    nextSearchParameters.set("viewMode", viewMode);
    setSearchParameters(nextSearchParameters);
  };

  /**
   * 표 ↔ 썸네일 보기 전환.
   */
  const updateViewMode = (nextViewMode: DocumentListViewMode): void => {
    // ★ 여기서는 기존 파라미터를 복사해서 시작한다. 위와 반대다.
    //   보기 방식만 바꾸는 것이므로 검색 조건은 그대로 유지해야 하기 때문이다.
    //   상황에 따라 "새로 만들기 / 복사해서 고치기"를 구분해 쓰자.
    const nextSearchParameters = new URLSearchParams(searchParameters);
    nextSearchParameters.set("viewMode", nextViewMode);

    // 보기 방식을 바꾸면 1페이지(0)로 되돌린다.
    // 표에서 5페이지를 보다가 썸네일로 바꾸면 화면 구성이 완전히 달라져
    // 사용자가 위치를 잃기 때문이다.
    nextSearchParameters.set("pageNumber", "0");

    setSearchParameters(nextSearchParameters);
    console.log("[DocumentListPage] 목록 보기 방식 변경", { previousViewMode: viewMode, nextViewMode });
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">{isHistory ? "Developer Blog" : "고급"}</span>
          <LearningGuideTitle guideId={isHistory ? undefined : "document"}>{isHistory ? "나의 업무 History" : "문서·이미지 게시판"}</LearningGuideTitle>
          <p>{isHistory ? "트러블슈팅, 개발 내용과 배운 점을 기록하는 개발 블로그입니다." : "같은 API 응답을 표 목록과 썸네일 카드형으로 각각 렌더링합니다."}</p>
        </div>
        {!isHistory || authSessionQuery.data?.superAdministrator ? <Link className="primary-link" to={`${basePath}/new`}>{isHistory ? "History 작성" : "새 문서 작성"}</Link> : null}
      </div>

      <DocumentSearchForm
        searchCondition={searchCondition}
        handleSearchConditionChange={updateSearchCondition}
      />

      <div className="list-toolbar">
        <div>
          <strong>보기 방식</strong>
          <span>선택한 방식은 URL에 저장됩니다.</span>
        </div>
        <div className="segmented-control view-mode-control" aria-label="문서 목록 보기 방식">
          <button
            type="button"
            className={viewMode === "table" ? "active" : ""}
            onClick={() => updateViewMode("table")}
          >
            ☷ 표 목록
          </button>
          <button
            type="button"
            className={viewMode === "thumbnail" ? "active" : ""}
            onClick={() => updateViewMode("thumbnail")}
          >
            ▦ 썸네일
          </button>
        </div>
      </div>

      {/* ══════ 화면 상태 1: 로딩 중 ══════════════════════════════
          ★ 썸네일 모드에서는 "스켈레톤(뼈대) UI"를 보여준다.
            빈 화면이나 스피너 대신 실제 카드와 같은 크기의 회색 상자를 깔아 두는 방식이다.
            - 곧 나타날 내용의 모양을 미리 알려 줘 기다림이 덜 지루하다
            - 데이터가 도착해도 레이아웃이 안 흔들린다 (요소가 밀리지 않는다)
            요즘 대부분의 서비스가 쓰는 방법이다.

          여기서는 key에 배열 인덱스를 써도 괜찮다.
          순서가 바뀌거나 삭제되지 않는 고정된 자리채움이기 때문이다. */}
      {documentListQuery.isPending ? (
        viewMode === "thumbnail" ? (
          <div className="document-thumbnail-grid" aria-label="문서 로딩 중">
            {Array.from({ length: 6 }, (_unusedValue, skeletonIndex) => (
              <div className="thumbnail-skeleton" key={skeletonIndex} />
            ))}
          </div>
        ) : <div className="state-panel">문서를 불러오는 중입니다.</div>
      ) : null}

      {/* ══════ 화면 상태 2: 오류 ══════════════════════════════════
          ★ 좋은 오류 화면의 세 가지 조건이 여기 다 들어 있다.
            1) 무엇이 실패했는지 알려 준다 ("문서 목록을 불러오지 못했습니다")
            2) 왜 그런지 알려 준다 (오류 코드를 한국어 문구로 변환)
            3) 무엇을 하면 되는지 준다 ("다시 시도" 버튼)

            빨간 글씨로 "Error"만 띄우고 끝내면 사용자는 새로고침밖에 할 게 없다.

          role="alert" → 화면 낭독기가 이 내용을 즉시 읽어 준다.

          `(() => { ... })()` 는 IIFE다. JSX의 `{}` 안에서 중간 변수를 계산하려고 쓴다.
          앞서 ApplicationSidebar에서도 본 패턴이다. */}
      {documentListQuery.isError ? (() => {
        // 정체불명의 에러를 표준 형태로 정리하고, 사전에서 한국어 문구를 찾는다.
        // shared/api/error 계층이 여기서 쓰인다.
        const problemDetails = convertRequestErrorToProblemDetails(documentListQuery.error);
        const message = apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail;
        return (
          <div className="state-panel error-state" role="alert">
            <h2>문서 목록을 불러오지 못했습니다.</h2>
            <p>{message}</p>
            {/* refetch()는 TanStack Query가 주는 "다시 요청" 함수다.
                페이지를 새로고침하지 않고 이 쿼리만 다시 시도한다. */}
            <button onClick={() => void documentListQuery.refetch()}>다시 시도</button>
          </div>
        );
      })() : null}

      {/* ══════ 화면 상태 3: 빈 결과 ══════════════════════════════
          ★ "데이터는 잘 받았는데 0건"인 경우다. 오류와 전혀 다른 상황이다.
            이 처리를 빼먹으면 화면이 텅 비어서 사용자는 고장 났다고 생각한다. */}
      {documentListQuery.data && documentListQuery.data.content.length === 0 ? (
        <div className="state-panel">검색 조건에 맞는 문서가 없습니다.</div>
      ) : null}

      {/* ══════ 화면 상태 4: 정상 목록 ════════════════════════════
          ★ `data && data.content.length > 0` 로 두 가지를 함께 확인한다.
            data가 있는지(로딩 끝) + 내용이 있는지(0건 아님).
            `?.`를 쓰지 않고 `&&`를 쓴 이유는, 이 안쪽에서
            data가 확실히 있다고 TypeScript가 인정해 주기 때문이다. */}
      {documentListQuery.data && documentListQuery.data.content.length > 0 ? (
        <>
          {viewMode === "table" ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>번호</th>
                    <th>대표 이미지</th>
                    <th>제목</th>
                    <th>상태</th>
                    <th>작성자</th>
                    <th>조회수</th>
                    <th>수정일</th>
                  </tr>
                </thead>
                <tbody>
                  {documentListQuery.data.content.map((documentItem) => (
                    <tr key={documentItem.documentId}>
                      <td>{documentItem.documentId}</td>
                      <td>
                        <div className="table-thumbnail-frame">
                          {/* ★ alt=""(빈 문자열)로 둔 것은 실수가 아니다.
                                옆 칸에 제목이 이미 글자로 있으므로 이 이미지는 장식일 뿐이다.
                                alt를 비우면 화면 낭독기가 이 이미지를 건너뛴다.
                                반대로 alt 속성을 아예 빼면 낭독기가 파일명을 읽어 버려 시끄럽다.
                                "장식 이미지는 alt=''"가 접근성의 정석이다. */}
                          {documentItem.thumbnailImageUrl ? (
                            <img src={documentItem.thumbnailImageUrl} alt="" loading="lazy" />
                          ) : <span>없음</span>}
                        </div>
                      </td>
                      <td><Link to={`${basePath}/${documentItem.documentId}`}>{documentItem.documentTitle}</Link></td>
                      <td>{documentItem.documentStatus}</td>
                      <td>{documentItem.authorName}</td>
                      <td>{documentItem.viewCount}</td>
                      <td>{new Date(documentItem.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="document-thumbnail-grid">
              {documentListQuery.data.content.map((documentItem) => (
                <DocumentThumbnailCard documentItem={documentItem} basePath={basePath} key={documentItem.documentId} />
              ))}
            </div>
          )}
          {/* 페이지네이션.
              페이지를 바꾸면 "기존 검색 조건은 그대로 두고 pageNumber만 바꾼" 객체를
              만들어 URL을 갱신한다. 전개 연산자의 전형적인 활용이다.
              검색어를 유지한 채 페이지만 넘어가는 자연스러운 동작이 된다. */}
          <DocumentPagination
            pageInformation={documentListQuery.data.pageInformation}
            handlePageChange={(pageNumber) => updateSearchCondition({ ...searchCondition, pageNumber })}
          />
        </>
      ) : null}
    </section>
  );
};
