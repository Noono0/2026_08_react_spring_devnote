/**
 * ============================================================================
 * HistoryListPage.tsx — 포트폴리오 "나의 업무 History" 목록 (/history)
 * ============================================================================
 *
 * 트러블슈팅·개발 경험을 기록하는 공개 게시판이다.
 *   - 방문자: 발행(PUBLISHED)된 글만 보고, 태그로 거를 수 있다
 *   - 슈퍼관리자: 임시저장·보관 글까지 보고, 새 글을 쓸 수 있다
 *
 * [화면 흐름]
 *   URL(?searchKeyword=…&tag=…&pageNumber=…) → 검증된 검색 조건 → useHistoryListQuery → 목록
 *   검색 조건을 useState가 아니라 URL에 두므로 새로고침·뒤로가기·링크 공유에도 조건이 유지된다.
 *
 * ※ 14단계 학습용 문서 목록(practice/14-documents/pages/DocumentListPage.tsx)과 구조가 같다.
 *   URL 검증·화면 상태 처리에 대한 자세한 학습 설명은 그 파일에 있다.
 *   예전에는 한 컴포넌트가 주소를 보고 두 화면을 겸했지만,
 *   학습자가 실습하며 고친 코드가 포트폴리오를 깨뜨리지 않도록 분리했다.
 */

import { Link, useSearchParams } from "react-router-dom";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { useHistoryListQuery, useHistoryTagsQuery } from "../hooks/useHistoryQueries";
import { HistoryTagFilter, HistoryTagList } from "../components/HistoryTags";
import { HistorySearchForm } from "../components/HistorySearchForm";
import { HistoryThumbnailCard } from "../components/HistoryThumbnailCard";
import type { HistorySearchCondition } from "../types/historyTypes";
import { Pagination } from "@/shared/ui/Pagination";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";

type HistoryListViewMode = "table" | "thumbnail";

// ── URL 값 허용 목록(allowlist). 목록에 없는 값은 기본값으로 바꾼다. ──
const searchTypeValues: HistorySearchCondition["searchType"][] = ["TITLE", "CONTENT", "TITLE_CONTENT", "AUTHOR"];
const historyStatusValues: NonNullable<HistorySearchCondition["documentStatus"]>[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const sortPropertyValues: HistorySearchCondition["sortProperty"][] = ["CREATED_AT", "UPDATED_AT", "VIEW_COUNT", "TITLE"];
const sortDirectionValues: HistorySearchCondition["sortDirection"][] = ["ASC", "DESC"];

/** URL에서 "정해진 값 중 하나"를 꺼낸다. 허용 목록에 없으면 기본값을 쓴다. */
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

/** URL에서 정수를 꺼낸다. NaN·소수·범위 밖 값은 기본값으로 바꾼다. (?pageSize=999999 같은 요청 방지) */
const getIntegerSearchParameter = (
  searchParameters: URLSearchParams,
  parameterName: string,
  fallbackValue: number,
  minimumValue: number,
  maximumValue: number,
): number => {
  const parameterValue = Number(searchParameters.get(parameterName));
  return Number.isSafeInteger(parameterValue) && parameterValue >= minimumValue && parameterValue <= maximumValue
    ? parameterValue
    : fallbackValue;
};

/** URL의 태그 값 검증: 앞뒤 공백을 지우고 1~20자일 때만 쓴다. (서버가 20자까지만 받는다) */
const parseTagSearchParameter = (rawTag: string | null): string | undefined => {
  const tag = rawTag?.trim() ?? "";
  return tag.length > 0 && tag.length <= 20 ? tag : undefined;
};

/** URL 전체 → 검증된 검색 조건 객체. 여기를 통과한 값만 아래 코드가 믿고 쓴다(신뢰 경계). */
const getSearchConditionFromUrl = (searchParameters: URLSearchParams): HistorySearchCondition => {
  // 상태는 "없으면 전체(undefined)"여야 해서 공통 함수 대신 직접 검사한다.
  const rawHistoryStatus = searchParameters.get("documentStatus");
  const documentStatus = rawHistoryStatus
    && historyStatusValues.includes(rawHistoryStatus as NonNullable<HistorySearchCondition["documentStatus"]>)
    ? (rawHistoryStatus as NonNullable<HistorySearchCondition["documentStatus"]>)
    : undefined;

  return {
    searchKeyword: searchParameters.get("searchKeyword") ?? "",
    searchType: getEnumSearchParameter(searchParameters, "searchType", searchTypeValues, "TITLE_CONTENT"),
    documentStatus,
    tag: parseTagSearchParameter(searchParameters.get("tag")),
    // 백엔드 페이지 번호는 0부터 센다. 화면에는 Pagination이 +1 해서 보여 준다.
    pageNumber: getIntegerSearchParameter(searchParameters, "pageNumber", 0, 0, 1_000_000),
    pageSize: getIntegerSearchParameter(searchParameters, "pageSize", 10, 1, 100),
    sortProperty: getEnumSearchParameter(searchParameters, "sortProperty", sortPropertyValues, "UPDATED_AT"),
    sortDirection: getEnumSearchParameter(searchParameters, "sortDirection", sortDirectionValues, "DESC"),
  };
};

const getViewModeFromUrl = (searchParameters: URLSearchParams): HistoryListViewMode =>
  searchParameters.get("viewMode") === "thumbnail" ? "thumbnail" : "table";

export const HistoryListPage = () => {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const authSessionQuery = useAuthSessionQuery();
  // 슈퍼관리자만 글쓰기 버튼을 보고 임시저장 글까지 조회할 수 있다.
  const isSuperAdministrator = authSessionQuery.data?.superAdministrator === true;

  const parsedSearchCondition = getSearchConditionFromUrl(searchParameters);

  // ★ 방문자는 상태를 PUBLISHED로 고정한다. ?documentStatus=DRAFT로 주소를 고쳐도 임시글이 보이지 않는다.
  //   이것은 화면 편의일 뿐이고, 최종 차단은 서버(HistoryController)가 한다.
  //   `as const`가 없으면 타입이 string으로 넓어져 documentStatus 자리에 들어가지 못한다.
  const searchCondition = isSuperAdministrator
    ? parsedSearchCondition
    : { ...parsedSearchCondition, documentStatus: "PUBLISHED" as const };

  const viewMode = getViewModeFromUrl(searchParameters);
  const historyListQuery = useHistoryListQuery(searchCondition);
  const historyTagsQuery = useHistoryTagsQuery();

  /** 검색 조건을 바꾼다 = 주소를 바꾼다. 빈 값은 주소에 넣지 않아 짧고 깔끔하게 유지한다. */
  const updateSearchCondition = (nextCondition: HistorySearchCondition): void => {
    const nextSearchParameters = new URLSearchParams();
    Object.entries(nextCondition).forEach(([parameterName, parameterValue]) => {
      if (parameterValue !== undefined && parameterValue !== "") {
        nextSearchParameters.set(parameterName, String(parameterValue));
      }
    });
    // 보기 방식은 검색 조건이 아니지만 주소에는 남겨 둔다.
    nextSearchParameters.set("viewMode", viewMode);
    setSearchParameters(nextSearchParameters);
  };

  /** 표 ↔ 썸네일 전환. 검색 조건은 유지하고 첫 페이지로 돌아간다. */
  const updateViewMode = (nextViewMode: HistoryListViewMode): void => {
    const nextSearchParameters = new URLSearchParams(searchParameters);
    nextSearchParameters.set("viewMode", nextViewMode);
    nextSearchParameters.set("pageNumber", "0");
    setSearchParameters(nextSearchParameters);
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">Developer Blog</span>
          <div className="page-title-with-guide"><h1>나의 업무 History</h1><FeatureHelpButton topic="history" /></div>
          <p>트러블슈팅, 개발 내용과 배운 점을 기록하는 개발 블로그입니다.</p>
        </div>
        {isSuperAdministrator ? <Link className="primary-link" to="/history/new">History 작성</Link> : null}
      </div>

      <HistorySearchForm
        searchCondition={searchCondition}
        handleSearchConditionChange={updateSearchCondition}
      />

      {/* 태그를 고르면 1페이지부터 다시 조회한다. */}
      <HistoryTagFilter
        tags={historyTagsQuery.data ?? []}
        selectedTag={searchCondition.tag}
        onSelect={(tag) => updateSearchCondition({ ...parsedSearchCondition, tag, pageNumber: 0 })}
      />

      <div className="list-toolbar">
        <div>
          <strong>보기 방식</strong>
          <span>선택한 방식은 URL에 저장됩니다.</span>
        </div>
        <div className="segmented-control view-mode-control" aria-label="문서 목록 보기 방식">
          <button type="button" className={viewMode === "table" ? "active" : ""} onClick={() => updateViewMode("table")}>
            ☷ 표 목록
          </button>
          <button type="button" className={viewMode === "thumbnail" ? "active" : ""} onClick={() => updateViewMode("thumbnail")}>
            ▦ 썸네일
          </button>
        </div>
      </div>

      {/* 화면 상태 1: 로딩 — 썸네일은 카드와 같은 크기의 회색 뼈대(스켈레톤)를 깔아 레이아웃이 흔들리지 않게 한다. */}
      {historyListQuery.isPending ? (
        viewMode === "thumbnail" ? (
          <div className="document-thumbnail-grid" aria-label="문서 로딩 중">
            {Array.from({ length: 6 }, (_unusedValue, skeletonIndex) => (
              <div className="thumbnail-skeleton" key={skeletonIndex} />
            ))}
          </div>
        ) : <div className="state-panel">문서를 불러오는 중입니다.</div>
      ) : null}

      {/* 화면 상태 2: 오류 — 무엇이 실패했는지, 왜인지, 무엇을 하면 되는지(다시 시도)를 함께 보여 준다. */}
      {historyListQuery.isError ? (() => {
        const problemDetails = convertRequestErrorToProblemDetails(historyListQuery.error);
        const message = apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail;
        return (
          <div className="state-panel error-state" role="alert">
            <h2>문서 목록을 불러오지 못했습니다.</h2>
            <p>{message}</p>
            <button onClick={() => void historyListQuery.refetch()}>다시 시도</button>
          </div>
        );
      })() : null}

      {/* 화면 상태 3: 빈 결과 */}
      {historyListQuery.data && historyListQuery.data.content.length === 0 ? (
        <div className="state-panel">검색 조건에 맞는 문서가 없습니다.</div>
      ) : null}

      {/* 화면 상태 4: 정상 목록 */}
      {historyListQuery.data && historyListQuery.data.content.length > 0 ? (
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
                  {historyListQuery.data.content.map((historyItem) => (
                    <tr key={historyItem.documentId}>
                      <td>{historyItem.documentId}</td>
                      <td>
                        <div className="table-thumbnail-frame">
                          {/* 옆 칸에 제목이 글자로 있으므로 이 이미지는 장식이다. 장식 이미지는 alt="". */}
                          {historyItem.thumbnailImageUrl ? (
                            <img src={historyItem.thumbnailImageUrl} alt="" loading="lazy" />
                          ) : <span>없음</span>}
                        </div>
                      </td>
                      <td><Link to={`/history/${historyItem.documentId}`}>{historyItem.documentTitle}</Link><HistoryTagList tags={historyItem.tags} /></td>
                      <td>{historyItem.documentStatus}</td>
                      <td>{historyItem.authorName}</td>
                      <td>{historyItem.viewCount}</td>
                      <td>{new Date(historyItem.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="document-thumbnail-grid">
              {historyListQuery.data.content.map((historyItem) => (
                <HistoryThumbnailCard historyItem={historyItem} key={historyItem.documentId} />
              ))}
            </div>
          )}
          {/* 검색 조건은 그대로 두고 pageNumber만 바꿔 주소를 갱신한다. */}
          <Pagination
            ariaLabel="문서 목록 페이지 이동"
            pageInformation={historyListQuery.data.pageInformation}
            handlePageChange={(pageNumber) => updateSearchCondition({ ...searchCondition, pageNumber })}
          />
        </>
      ) : null}
    </section>
  );
};
