/**
 * ============================================================================
 * DiagramEditorPage.tsx — 다이어그램 편집 화면
 * ============================================================================
 *
 * 이 화면이 이번 기능의 중심이다. 다음을 한곳에서 처리한다.
 *   - React Flow 캔버스로 드래그 편집
 *   - SQL DDL → ERD 자동 생성 (기존 sqlSchemaAnalyzer 재사용)
 *   - ERD → CREATE TABLE DDL 생성
 *   - 저장(낙관적 잠금) / 버전 목록 / 이전 버전 복원
 *   - PNG · SVG 내보내기
 *
 * ★ 서버는 저장·조회만 한다. 파싱·렌더링·이미지 변환은 전부 브라우저에서 처리한다.
 *   저사양 서버 배포를 전제로 한 설계다.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toPng, toSvg } from "html-to-image";
import { DiagramCanvas } from "../components/DiagramCanvas";
import {
  useDiagramDetailQuery,
  useDiagramVersionListQuery,
  useRestoreDiagramVersionMutation,
  useUpdateDiagramMutation,
} from "../hooks/useDiagramQueries";
import {
  convertSqlSchemaToDiagramModel,
  createEmptyDiagramModel,
  createNewTableNode,
  generateCreateTableSql,
  parseDiagramModel,
  stringifyDiagramModel,
} from "../utils/diagramModel";
import type { DiagramModel, DiagramType } from "../types/diagramTypes";
import { analyzeSqlSchema } from "@/features/utility/utils/sqlSchemaAnalyzer";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { apiErrorMessageMap } from "@/shared/api/error/apiErrorMessageMap";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

const DIAGRAM_TYPES: DiagramType[] = ["ERD", "FLOWCHART", "UML", "SYSTEM", "GENERAL"];

/** 주소의 다이어그램 번호를 검증한다. (DocumentDetailPage와 같은 방식) */
const parseDiagramId = (rawValue: string | undefined): number | undefined => {
  if (!rawValue || !/^[1-9]\d*$/.test(rawValue)) return undefined;
  const parsed = Number(rawValue);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

export const DiagramEditorPage = () => {
  const routeParameters = useParams();
  const navigate = useNavigate();
  const diagramId = parseDiagramId(routeParameters.diagramId);

  const diagramDetailQuery = useDiagramDetailQuery(diagramId);
  const versionListQuery = useDiagramVersionListQuery(diagramId);
  const updateDiagramMutation = useUpdateDiagramMutation(diagramId ?? 0);
  const restoreVersionMutation = useRestoreDiagramVersionMutation(diagramId ?? 0);

  // ── 편집 중인 상태 ──────────────────────────────────────────────
  const [diagramModel, setDiagramModel] = useState<DiagramModel>(createEmptyDiagramModel());
  const [diagramTitle, setDiagramTitle] = useState("");
  const [diagramDescription, setDiagramDescription] = useState("");
  const [diagramType, setDiagramType] = useState<DiagramType>("ERD");
  const [sqlInput, setSqlInput] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [restoreTargetVersion, setRestoreTargetVersion] = useState<number | null>(null);

  const canvasReference = useRef<HTMLDivElement>(null);

  // 서버 데이터가 도착하면 편집 상태를 채운다.
  // (DocumentEditorPage와 같은 이유로 useEffect가 필요하다)
  useEffect(() => {
    if (!diagramDetailQuery.data) return;
    setDiagramModel(parseDiagramModel(diagramDetailQuery.data.diagramModelJson));
    setDiagramTitle(diagramDetailQuery.data.diagramTitle);
    setDiagramDescription(diagramDetailQuery.data.diagramDescription);
    setDiagramType(diagramDetailQuery.data.diagramType);
    setHasUnsavedChanges(false);
  }, [diagramDetailQuery.data]);

  // 작성 중 이탈 방지. 저장 안 한 변경이 있을 때만 경고한다.
  useEffect(() => {
    const handleBeforeUnload = (beforeUnloadEvent: BeforeUnloadEvent): void => {
      if (hasUnsavedChanges) beforeUnloadEvent.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const applyModelChange = (nextModel: DiagramModel): void => {
    setDiagramModel(nextModel);
    setHasUnsavedChanges(true);
  };

  /** ★ SQL DDL → ERD. 기존 파서를 그대로 재사용한다. */
  const handleImportSql = (): void => {
    if (!sqlInput.trim()) {
      applicationNotification.warning("변환할 CREATE TABLE 문을 입력해 주세요.");
      return;
    }
    const schemaModel = analyzeSqlSchema(sqlInput);
    if (schemaModel.tables.length === 0) {
      applicationNotification.warning("CREATE TABLE 문을 찾지 못했습니다.", "문법을 다시 확인해 주세요.");
      return;
    }
    applyModelChange(convertSqlSchemaToDiagramModel(schemaModel));
    // 파서가 남긴 경고(지원하지 않는 구문 등)를 사용자에게 그대로 전달한다.
    if (schemaModel.warnings.length > 0) {
      applicationNotification.warning(`${schemaModel.tables.length}개 테이블을 변환했습니다.`, schemaModel.warnings[0]);
    } else {
      applicationNotification.success(`${schemaModel.tables.length}개 테이블을 ERD로 만들었습니다.`);
    }
  };

  /** ★ ERD → DDL. 생성 결과를 SQL 입력창에 넣어 바로 복사할 수 있게 한다. */
  const handleExportSql = (): void => {
    const generatedSql = generateCreateTableSql(diagramModel);
    setSqlInput(generatedSql);
    applicationNotification.success("현재 다이어그램을 DDL로 변환했습니다.");
  };

  const handleAddTable = (): void => {
    applyModelChange({
      ...diagramModel,
      nodes: [...diagramModel.nodes, createNewTableNode(diagramModel)],
    });
  };

  const handleSave = async (): Promise<void> => {
    if (!diagramId) return;
    if (!diagramTitle.trim()) {
      applicationNotification.warning("다이어그램 제목을 입력해 주세요.");
      return;
    }
    try {
      await updateDiagramMutation.mutateAsync({
        diagramTitle: diagramTitle.trim(),
        diagramDescription: diagramDescription.trim(),
        diagramType,
        diagramModelJson: stringifyDiagramModel(diagramModel),
        // 낙관적 잠금: 내가 알고 있는 버전을 함께 보낸다.
        versionNumber: diagramDetailQuery.data?.versionNumber,
      });
      setHasUnsavedChanges(false);
      applicationNotification.success("다이어그램을 저장했습니다.");
    } catch (requestError) {
      // 버전 충돌(409)이면 apiErrorMessageMap 이 안내 문구를 대신 보여준다.
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    }
  };

  const handleRestoreVersion = async (): Promise<void> => {
    if (restoreTargetVersion === null) return;
    try {
      await restoreVersionMutation.mutateAsync(restoreTargetVersion);
      applicationNotification.success(`${restoreTargetVersion}번 버전으로 되돌렸습니다.`);
    } catch (requestError) {
      applicationNotification.apiError(convertRequestErrorToProblemDetails(requestError));
    } finally {
      setRestoreTargetVersion(null);
    }
  };

  /**
   * PNG / SVG 내보내기.
   *
   * ★ 서버를 거치지 않고 브라우저에서 캔버스 DOM을 그대로 이미지로 바꾼다.
   *   서버에서 렌더링하려면 헤드리스 브라우저가 필요해 저사양 서버에서는 부담이 크다.
   */
  const handleExportImage = async (imageFormat: "png" | "svg"): Promise<void> => {
    const canvasElement = canvasReference.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!canvasElement) {
      applicationNotification.error("캔버스를 찾지 못했습니다.", "잠시 후 다시 시도해 주세요.");
      return;
    }
    try {
      const dataUrl = imageFormat === "png"
        ? await toPng(canvasElement, { backgroundColor: "#ffffff", pixelRatio: 2 })
        : await toSvg(canvasElement);
      const downloadLink = document.createElement("a");
      downloadLink.href = dataUrl;
      downloadLink.download = `${diagramTitle || "diagram"}.${imageFormat}`;
      downloadLink.click();
      applicationNotification.success(`${imageFormat.toUpperCase()} 파일을 내려받았습니다.`);
    } catch {
      applicationNotification.error("이미지를 만들지 못했습니다.", "다이어그램이 비어 있지 않은지 확인해 주세요.");
    }
  };

  // ── 상태별 화면 ────────────────────────────────────────────────
  if (!diagramId) {
    return (
      <div className="state-panel error-state" role="alert">
        <h1>잘못된 다이어그램 주소입니다.</h1>
        <Link to="/utilities/diagrams">다이어그램 목록으로 이동</Link>
      </div>
    );
  }
  if (diagramDetailQuery.isPending) {
    return <div className="state-panel">다이어그램을 불러오는 중입니다.</div>;
  }
  if (diagramDetailQuery.isError || !diagramDetailQuery.data) {
    const problemDetails = convertRequestErrorToProblemDetails(diagramDetailQuery.error);
    return (
      <div className="state-panel error-state" role="alert">
        <h1>다이어그램을 불러오지 못했습니다.</h1>
        <p>{apiErrorMessageMap[problemDetails.errorCode] ?? problemDetails.detail}</p>
        <button type="button" onClick={() => void diagramDetailQuery.refetch()}>다시 시도</button>
      </div>
    );
  }

  return (
    <section className="diagram-editor-page">
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-고급">Diagram Designer</span>
          <h1>다이어그램 편집</h1>
          <p>테이블을 드래그해 배치하고, 오른쪽 손잡이를 끌어 관계를 연결합니다.</p>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => void handleSave()} disabled={updateDiagramMutation.isPending}>
            {updateDiagramMutation.isPending ? "저장 중..." : hasUnsavedChanges ? "저장 *" : "저장"}
          </button>
          <button type="button" className="secondary-button" onClick={() => navigate("/utilities/diagrams")}>
            목록
          </button>
        </div>
      </div>

      <div className="advanced-tool-actions">
        <label>
          제목
          <input
            value={diagramTitle}
            onChange={(changeEvent) => { setDiagramTitle(changeEvent.target.value); setHasUnsavedChanges(true); }}
            maxLength={200}
          />
        </label>
        <label>
          종류
          <select
            value={diagramType}
            onChange={(changeEvent) => { setDiagramType(changeEvent.target.value as DiagramType); setHasUnsavedChanges(true); }}
          >
            {DIAGRAM_TYPES.map((typeValue) => <option key={typeValue} value={typeValue}>{typeValue}</option>)}
          </select>
        </label>
        <button type="button" className="secondary-button" onClick={handleAddTable}>테이블 추가</button>
        <button type="button" className="ghost-button" onClick={() => void handleExportImage("png")}>PNG 내보내기</button>
        <button type="button" className="ghost-button" onClick={() => void handleExportImage("svg")}>SVG 내보내기</button>
      </div>

      <DiagramCanvas
        diagramModel={diagramModel}
        handleModelChange={applyModelChange}
        canvasReference={canvasReference}
      />

      {/* ── SQL 연동 패널 (Diagram ↔ SQL 흐름) ───────────────────── */}
      <article className="advanced-panel">
        <header>
          <div>
            <h2>SQL 연동</h2>
            <span>CREATE TABLE 문을 붙여 넣어 ERD를 만들거나, 지금 다이어그램을 DDL로 뽑아냅니다.</span>
          </div>
        </header>
        <div className="advanced-tool-actions">
          <button type="button" onClick={handleImportSql}>SQL → ERD</button>
          <button type="button" className="secondary-button" onClick={handleExportSql}>ERD → DDL</button>
        </div>
        <label>
          <span>CREATE TABLE DDL</span>
          <textarea
            aria-label="CREATE TABLE DDL"
            value={sqlInput}
            spellCheck={false}
            rows={10}
            onChange={(changeEvent) => setSqlInput(changeEvent.target.value)}
            placeholder={"CREATE TABLE MEMBER (\n    member_id BIGINT PRIMARY KEY,\n    email VARCHAR(100)\n);"}
          />
        </label>
      </article>

      {/* ── 버전 이력 ────────────────────────────────────────────── */}
      <article className="advanced-panel">
        <header>
          <div>
            <h2>버전 이력</h2>
            <span>내용이 바뀐 저장만 이력으로 남습니다. 최근 30개까지 보관합니다.</span>
          </div>
        </header>
        {versionListQuery.isPending ? <div className="state-panel">이력을 불러오는 중입니다.</div> : null}
        {versionListQuery.data && versionListQuery.data.length === 0 ? (
          <div className="state-panel">아직 저장 이력이 없습니다.</div>
        ) : null}
        {versionListQuery.data && versionListQuery.data.length > 0 ? (
          <ul className="audit-log-list">
            {versionListQuery.data.map((version) => (
              <li key={version.diagramVersionId}>
                <strong>버전 {version.versionNumber}</strong>
                <span>{version.changeSummary || "변경 요약 없음"}</span>
                <small>{new Date(version.createdAt).toLocaleString("ko-KR")}</small>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setRestoreTargetVersion(version.versionNumber)}
                  disabled={version.versionNumber === diagramDetailQuery.data.versionNumber}
                >
                  이 버전으로 되돌리기
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      <ConfirmDialog
        isOpen={restoreTargetVersion !== null}
        title="이전 버전으로 되돌리기"
        description={`${restoreTargetVersion ?? ""}번 버전 내용으로 되돌립니다. 지금 내용도 이력에 남아 있어 다시 돌아올 수 있습니다.`}
        confirmButtonLabel="되돌리기"
        isConfirming={restoreVersionMutation.isPending}
        onConfirm={() => void handleRestoreVersion()}
        onCancel={() => setRestoreTargetVersion(null)}
      />
    </section>
  );
};
