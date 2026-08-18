/**
 * ============================================================================
 * DiagramListPage.tsx — 내 다이어그램 목록
 * ============================================================================
 *
 * 문서 목록(DocumentListPage)과 같은 원칙을 따른다.
 *   - 검색 조건을 URL에 둔다 (공유·새로고침·뒤로가기가 그대로 동작)
 *   - 로딩 / 오류 / 빈 결과 / 정상 네 가지 상태를 모두 처리한다
 */

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCreateDiagramMutation, useDeleteDiagramMutation, useDiagramListQuery } from "../hooks/useDiagramQueries";
import { createEmptyDiagramModel, stringifyDiagramModel } from "../utils/diagramModel";
import type { DiagramListItem, DiagramSearchCondition, DiagramType } from "../types/diagramTypes";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";

const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  ERD: "ERD",
  FLOWCHART: "순서도",
  UML: "UML",
  SYSTEM: "시스템 구성도",
  GENERAL: "일반",
};

/** URL 쿼리스트링에서 검색 조건을 읽는다. 이상한 값은 기본값으로 되돌린다. */
const readSearchConditionFromUrl = (searchParameters: URLSearchParams): DiagramSearchCondition => {
  const rawType = searchParameters.get("diagramType");
  const diagramType = rawType && rawType in DIAGRAM_TYPE_LABELS ? (rawType as DiagramType) : undefined;
  const rawPageNumber = Number(searchParameters.get("pageNumber"));

  return {
    searchKeyword: searchParameters.get("searchKeyword") ?? "",
    diagramType,
    // URL은 사용자가 직접 고칠 수 있으므로 항상 검증한다.
    pageNumber: Number.isSafeInteger(rawPageNumber) && rawPageNumber >= 0 ? rawPageNumber : 0,
    pageSize: 12,
  };
};

export const DiagramListPage = () => {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const navigate = useNavigate();
  const searchCondition = readSearchConditionFromUrl(searchParameters);

  // 입력 중인 검색어는 지역 상태로 두고, 제출할 때만 URL에 반영한다.
  // (글자마다 URL을 바꾸면 요청이 폭주한다 — DocumentSearchForm과 같은 판단)
  const [searchKeywordInput, setSearchKeywordInput] = useState(searchCondition.searchKeyword);
  const [deleteTarget, setDeleteTarget] = useState<DiagramListItem | null>(null);

  const diagramListQuery = useDiagramListQuery(searchCondition);
  const createDiagramMutation = useCreateDiagramMutation();
  const deleteDiagramMutation = useDeleteDiagramMutation();

  const updateSearchParameters = (nextCondition: Partial<DiagramSearchCondition>): void => {
    const merged = { ...searchCondition, ...nextCondition };
    const nextParameters = new URLSearchParams();
    if (merged.searchKeyword) nextParameters.set("searchKeyword", merged.searchKeyword);
    if (merged.diagramType) nextParameters.set("diagramType", merged.diagramType);
    if (merged.pageNumber > 0) nextParameters.set("pageNumber", String(merged.pageNumber));
    setSearchParameters(nextParameters);
  };

  /** 빈 다이어그램을 만들고 곧바로 편집 화면으로 이동한다. */
  const handleCreate = async (): Promise<void> => {
    try {
      const created = await createDiagramMutation.mutateAsync({
        diagramTitle: "새 다이어그램",
        diagramDescription: "",
        diagramType: "ERD",
        diagramModelJson: stringifyDiagramModel(createEmptyDiagramModel()),
        changeSummary: "최초 생성",
      });
      applicationNotification.success("다이어그램을 만들었습니다.");
      navigate(`/utilities/diagrams/${created.diagramId}`);
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteDiagramMutation.mutateAsync(deleteTarget.diagramId);
      applicationNotification.success("다이어그램을 삭제했습니다.");
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">Diagram Designer</span>
          <h1>다이어그램</h1>
          <p>ERD·순서도·시스템 구성도를 그리고 저장합니다. SQL DDL을 붙여 넣어 ERD를 자동으로 만들 수도 있습니다.</p>
        </div>
        <button type="button" onClick={() => void handleCreate()} disabled={createDiagramMutation.isPending}>
          {createDiagramMutation.isPending ? "만드는 중..." : "새 다이어그램"}
        </button>
      </div>

      <form
        className="search-panel"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          updateSearchParameters({ searchKeyword: searchKeywordInput.trim(), pageNumber: 0 });
        }}
      >
        <label className="search-keyword-field">
          검색어
          <input
            value={searchKeywordInput}
            onChange={(changeEvent) => setSearchKeywordInput(changeEvent.target.value)}
            placeholder="제목 또는 설명"
          />
        </label>
        <label>
          종류
          <select
            value={searchCondition.diagramType ?? ""}
            onChange={(changeEvent) => updateSearchParameters({
              diagramType: changeEvent.target.value === "" ? undefined : (changeEvent.target.value as DiagramType),
              pageNumber: 0,
            })}
          >
            <option value="">전체</option>
            {Object.entries(DIAGRAM_TYPE_LABELS).map(([typeValue, typeLabel]) => (
              <option key={typeValue} value={typeValue}>{typeLabel}</option>
            ))}
          </select>
        </label>
        <button type="submit">검색</button>
      </form>

      {/* ── 상태 1: 로딩 ── */}
      {diagramListQuery.isPending ? (
        <div className="state-panel">다이어그램 목록을 불러오는 중입니다.</div>
      ) : null}

      {/* ── 상태 2: 오류 ── */}
      {diagramListQuery.isError ? (() => {
        const problemDetails = convertRequestErrorToProblemDetails(diagramListQuery.error);
        return (
          <div className="state-panel error-state" role="alert">
            <h2>다이어그램 목록을 불러오지 못했습니다.</h2>
            <p>{apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail}</p>
            <button type="button" onClick={() => void diagramListQuery.refetch()}>다시 시도</button>
          </div>
        );
      })() : null}

      {/* ── 상태 3: 빈 결과 (처음 사용자를 위한 안내를 함께 준다) ── */}
      {diagramListQuery.data && diagramListQuery.data.content.length === 0 ? (
        <div className="state-panel">
          <p>아직 만든 다이어그램이 없습니다.</p>
          <p>“새 다이어그램”을 누르면 빈 캔버스가 열리고, 편집 화면에서 SQL DDL을 붙여 넣어 ERD를 자동 생성할 수도 있습니다.</p>
        </div>
      ) : null}

      {/* ── 상태 4: 목록 ── */}
      {diagramListQuery.data && diagramListQuery.data.content.length > 0 ? (
        <div className="document-thumbnail-grid">
          {diagramListQuery.data.content.map((diagramItem) => (
            <article className="practice-card" key={diagramItem.diagramId}>
              <h2>
                <Link to={`/utilities/diagrams/${diagramItem.diagramId}`}>{diagramItem.diagramTitle}</Link>
              </h2>
              <p>{diagramItem.diagramDescription || "설명 없음"}</p>
              <div className="document-card-metadata">
                <span>{DIAGRAM_TYPE_LABELS[diagramItem.diagramType]}</span>
                <span>버전 {diagramItem.versionNumber}</span>
                <span>{new Date(diagramItem.updatedAt).toLocaleString("ko-KR")}</span>
              </div>
              <div className="button-row compact-button-row">
                <Link className="secondary-link" to={`/utilities/diagrams/${diagramItem.diagramId}`}>편집</Link>
                <button type="button" className="danger-button" onClick={() => setDeleteTarget(diagramItem)}>삭제</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="다이어그램 삭제"
        description={`“${deleteTarget?.diagramTitle ?? ""}”을(를) 삭제할까요? 저장된 버전 이력도 함께 보이지 않게 됩니다.`}
        confirmButtonLabel="삭제"
        isConfirming={deleteDiagramMutation.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
};
