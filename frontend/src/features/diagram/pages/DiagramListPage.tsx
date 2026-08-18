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
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
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
  const [helpOpen, setHelpOpen] = useState(false);

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
      <UtilityPageTitle
        kicker="Developer Utility · Design"
        title="Diagram Designer"
        description="ERD·순서도·시스템 구성도를 그려 저장하고, 버전으로 되돌릴 수 있습니다."
        onHelpOpen={() => setHelpOpen(true)}
      />

      <div className="page-heading-row">
        <div>
          <p>내가 만든 다이어그램 목록입니다. 제목을 누르면 편집 화면이 열립니다.</p>
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

      <UtilityHelpDialog
        isOpen={helpOpen}
        title="Diagram Designer"
        description="테이블 구조나 흐름도를 그려 저장하고, 필요하면 이전 버전으로 되돌립니다."
        onClose={() => setHelpOpen(false)}
      >
        <article>
          <h3>시작하는 방법 두 가지</h3>
          <ul>
            <li><strong>빈 캔버스에서 그리기</strong>: “새 다이어그램”을 누른 뒤 편집 화면에서 “테이블 추가”</li>
            <li><strong>SQL로 자동 생성</strong>: 편집 화면 아래 SQL 칸에 CREATE TABLE 문을 붙여 넣고 “SQL → ERD”</li>
          </ul>
        </article>
        <article>
          <h3>편집 방법</h3>
          <ul>
            <li>테이블을 끌어서 위치를 옮깁니다.</li>
            <li>테이블 오른쪽 손잡이를 다른 테이블로 끌면 관계(외래키)가 연결됩니다.</li>
            <li>선이나 테이블을 선택하고 Delete 키를 누르면 지워집니다.</li>
          </ul>
        </article>
        <article>
          <h3>버전 관리</h3>
          <p>
            저장할 때 내용이 실제로 바뀐 경우에만 이력이 남습니다. 위치만 조금 옮기고 반복 저장해도 이력이 쌓이지 않습니다.
            다이어그램당 최근 30개까지 보관하며, 되돌리기도 새 버전으로 기록되므로 되돌린 뒤 다시 원래대로 돌아올 수 있습니다.
          </p>
        </article>
        <article>
          <h3>내보내기</h3>
          <p>편집 화면에서 PNG·SVG로 내려받을 수 있고, “ERD → DDL”로 CREATE TABLE 문을 만들어 복사할 수 있습니다.</p>
        </article>
        <article>
          <h3>알아둘 점</h3>
          <ul>
            <li>이 도구는 <strong>로그인한 내 계정에 저장</strong>됩니다. 다른 사람은 볼 수 없습니다.</li>
            <li>DDL 생성 시 인덱스·기본값·CHECK 제약은 만들지 않습니다. 구조 설계용이며 실제 운영 DDL은 손봐야 합니다.</li>
            <li>같은 다이어그램을 두 화면에서 동시에 편집하면 나중에 저장한 쪽이 거부됩니다(먼저 저장한 내용을 덮어쓰지 않기 위함).</li>
          </ul>
        </article>
      </UtilityHelpDialog>
    </section>
  );
};
