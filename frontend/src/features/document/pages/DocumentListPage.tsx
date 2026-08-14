import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useDocumentListQuery } from "../hooks/useDocumentQueries";
import type { DocumentSearchCondition } from "../types/documentTypes";
import { DocumentSearchForm } from "../components/DocumentSearchForm";
import { DocumentPagination } from "../components/DocumentPagination";
import { DocumentThumbnailCard } from "../components/DocumentThumbnailCard";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";

export type DocumentListViewMode = "table" | "thumbnail";

const searchTypeValues: DocumentSearchCondition["searchType"][] = [
  "TITLE",
  "CONTENT",
  "TITLE_CONTENT",
  "AUTHOR",
];
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

const getEnumSearchParameter = <EnumValue extends string>(
  searchParameters: URLSearchParams,
  parameterName: string,
  allowedValues: readonly EnumValue[],
  fallbackValue: EnumValue,
): EnumValue => {
  const parameterValue = searchParameters.get(parameterName);
  return parameterValue && allowedValues.includes(parameterValue as EnumValue)
    ? (parameterValue as EnumValue)
    : fallbackValue;
};

const getIntegerSearchParameter = (
  searchParameters: URLSearchParams,
  parameterName: string,
  fallbackValue: number,
  minimumValue: number,
  maximumValue: number,
): number => {
  const parameterValue = Number(searchParameters.get(parameterName));
  return Number.isSafeInteger(parameterValue)
    && parameterValue >= minimumValue
    && parameterValue <= maximumValue
    ? parameterValue
    : fallbackValue;
};

const getSearchConditionFromUrl = (searchParameters: URLSearchParams): DocumentSearchCondition => {
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
    pageNumber: getIntegerSearchParameter(searchParameters, "pageNumber", 0, 0, 1_000_000),
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
  const [searchParameters, setSearchParameters] = useSearchParams();
  const location = useLocation();
  const authSessionQuery = useAuthSessionQuery();
  const isHistory = location.pathname.startsWith("/history");
  const basePath = isHistory ? "/history" : "/react/documents";
  const parsedSearchCondition = getSearchConditionFromUrl(searchParameters);
  const searchCondition = isHistory && !authSessionQuery.data?.superAdministrator
    ? { ...parsedSearchCondition, documentStatus: "PUBLISHED" as const }
    : parsedSearchCondition;
  const viewMode = getViewModeFromUrl(searchParameters);
  const documentListQuery = useDocumentListQuery(searchCondition, isHistory);

  const updateSearchCondition = (nextCondition: DocumentSearchCondition): void => {
    const nextSearchParameters = new URLSearchParams();
    Object.entries(nextCondition).forEach(([parameterName, parameterValue]) => {
      if (parameterValue !== undefined && parameterValue !== "") {
        nextSearchParameters.set(parameterName, String(parameterValue));
      }
    });
    nextSearchParameters.set("viewMode", viewMode);
    setSearchParameters(nextSearchParameters);
  };

  const updateViewMode = (nextViewMode: DocumentListViewMode): void => {
    const nextSearchParameters = new URLSearchParams(searchParameters);
    nextSearchParameters.set("viewMode", nextViewMode);
    nextSearchParameters.set("pageNumber", "0");
    setSearchParameters(nextSearchParameters);
    console.log("[DocumentListPage] 목록 보기 방식 변경", { previousViewMode: viewMode, nextViewMode });
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">{isHistory ? "Developer Blog" : "고급"}</span>
          <h1>{isHistory ? "나의 업무 History" : "문서·이미지 게시판"}</h1>
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

      {documentListQuery.isPending ? (
        viewMode === "thumbnail" ? (
          <div className="document-thumbnail-grid" aria-label="문서 로딩 중">
            {Array.from({ length: 6 }, (_unusedValue, skeletonIndex) => (
              <div className="thumbnail-skeleton" key={skeletonIndex} />
            ))}
          </div>
        ) : <div className="state-panel">문서를 불러오는 중입니다.</div>
      ) : null}

      {documentListQuery.isError ? (() => {
        const problemDetails = convertRequestErrorToProblemDetails(documentListQuery.error);
        const message = apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail;
        return (
          <div className="state-panel error-state" role="alert">
            <h2>문서 목록을 불러오지 못했습니다.</h2>
            <p>{message}</p>
            <button onClick={() => void documentListQuery.refetch()}>다시 시도</button>
          </div>
        );
      })() : null}

      {documentListQuery.data && documentListQuery.data.content.length === 0 ? (
        <div className="state-panel">검색 조건에 맞는 문서가 없습니다.</div>
      ) : null}

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
          <DocumentPagination
            pageInformation={documentListQuery.data.pageInformation}
            handlePageChange={(pageNumber) => updateSearchCondition({ ...searchCondition, pageNumber })}
          />
        </>
      ) : null}
    </section>
  );
};
