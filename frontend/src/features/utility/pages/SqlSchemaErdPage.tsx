import { useMemo, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { analyzeSqlSchema, compareSqlSchemas, generateMermaidErDiagram, type SqlSchemaModel } from "@/features/utility/utils/sqlSchemaAnalyzer";
import { applicationNotification } from "@/shared/notification/applicationNotification";

const sampleDdl = `CREATE TABLE member (
  member_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  grade VARCHAR(20) NOT NULL DEFAULT 'BRONZE',
  created_at DATETIME NOT NULL
);

CREATE TABLE post (
  post_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_post_member FOREIGN KEY (member_id) REFERENCES member(member_id)
);

CREATE TABLE comment (
  comment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  content VARCHAR(1000) NOT NULL,
  CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES post(post_id),
  CONSTRAINT fk_comment_member FOREIGN KEY (member_id) REFERENCES member(member_id)
);`;

interface TablePosition { name: string; x: number; y: number; width: number; height: number }

export const SqlSchemaErdPage = () => {
  const initialModel = useMemo(() => analyzeSqlSchema(sampleDdl), []);
  const [source, setSource] = useState(sampleDdl);
  const [comparisonSource, setComparisonSource] = useState(sampleDdl.replace("title VARCHAR(200)", "title VARCHAR(300)").replace("content TEXT,", "content TEXT,\n  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',"));
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [model, setModel] = useState<SqlSchemaModel>(initialModel);
  const [selectedTableName, setSelectedTableName] = useState(initialModel.tables[0]?.name ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [zoom, setZoom] = useState(100);
  const [helpOpen, setHelpOpen] = useState(false);
  const selectedTable = model.tables.find((table) => table.name === selectedTableName) ?? model.tables[0];
  const mermaid = generateMermaidErDiagram(model);
  const comparison = useMemo(() => {
    if (!comparisonEnabled) return undefined;
    try { return compareSqlSchemas(model, analyzeSqlSchema(comparisonSource)); } catch { return undefined; }
  }, [comparisonEnabled, comparisonSource, model]);
  const positions = useMemo<TablePosition[]>(() => model.tables.map((table, index) => ({
    name: table.name, x: 30 + (index % 3) * 300, y: 30 + Math.floor(index / 3) * 245, width: 250, height: 64 + Math.min(table.columns.length, 7) * 24,
  })), [model]);
  const canvasHeight = Math.max(360, (Math.ceil(model.tables.length / 3) * 245) + 40);

  const analyze = (): void => {
    try { const nextModel = analyzeSqlSchema(source); setModel(nextModel); setSelectedTableName(nextModel.tables[0]?.name ?? ""); setErrorMessage(""); applicationNotification.success(`${nextModel.tables.length}개 테이블을 분석했습니다.`); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "DDL을 분석하지 못했습니다."); }
  };

  return (
    <section className="site-page utility-workbench-page advanced-utility-page sql-erd-page">
      <UtilityPageTitle kicker="Developer Utility · Database" title="SQL Schema · ERD Viewer" description="MySQL 중심 CREATE TABLE DDL에서 컬럼·키·관계를 추출하고 ERD와 Schema 변경점을 확인합니다." onHelpOpen={() => setHelpOpen(true)} />
      <div className="advanced-tool-actions"><button type="button" onClick={analyze}>Schema 분석</button><button type="button" className="ghost-button" onClick={() => { setSource(sampleDdl); setModel(initialModel); setErrorMessage(""); }}>예제 복원</button><label className="checkbox-label"><input type="checkbox" checked={comparisonEnabled} onChange={(event) => setComparisonEnabled(event.target.checked)} />변경 DDL 비교</label><label>확대<input type="range" min={60} max={160} step={10} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><span>{zoom}%</span><button type="button" className="ghost-button" onClick={() => void copyText(mermaid).then(() => applicationNotification.success("Mermaid ERD를 복사했습니다."))}>Mermaid 복사</button><button type="button" className="ghost-button" onClick={() => downloadText("schema-erd.mmd", mermaid)}>Mermaid 다운로드</button></div>
      {errorMessage ? <p className="field-error advanced-error" role="alert">{errorMessage}</p> : null}
      <div className={`sql-source-grid${comparisonEnabled ? " comparing" : ""}`}><label><span>{comparisonEnabled ? "변경 전 DDL" : "CREATE TABLE DDL"}</span><textarea aria-label="SQL Schema DDL" value={source} spellCheck={false} onChange={(event) => setSource(event.target.value)} /></label>{comparisonEnabled ? <label><span>변경 후 DDL</span><textarea aria-label="변경 후 SQL Schema DDL" value={comparisonSource} spellCheck={false} onChange={(event) => setComparisonSource(event.target.value)} /></label> : null}</div>
      <section className="advanced-summary-strip"><article><span>Tables</span><strong>{model.tables.length}</strong><small>해석한 테이블</small></article><article><span>Columns</span><strong>{model.tables.reduce((count, table) => count + table.columns.length, 0)}</strong><small>전체 컬럼</small></article><article><span>Relations</span><strong>{model.tables.reduce((count, table) => count + table.foreignKeys.length, 0)}</strong><small>Foreign Keys</small></article><article><span>Warnings</span><strong>{model.warnings.length}</strong><small>검토할 항목</small></article></section>
      {model.warnings.length > 0 ? <details className="advanced-warning-list"><summary>Schema 경고 {model.warnings.length}개</summary><ul>{model.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
      {comparisonEnabled ? <section className="schema-diff-strip"><article><strong>추가 테이블</strong><span>{comparison?.addedTables.join(", ") || "없음"}</span></article><article><strong>삭제 테이블</strong><span>{comparison?.removedTables.join(", ") || "없음"}</span></article><article><strong>변경 테이블</strong><span>{comparison?.changedTables.map((item) => item.table).join(", ") || "없음"}</span></article>{comparison?.changedTables.map((item) => <article className="schema-change-detail" key={item.table}><strong>{item.table}</strong><span>+ {item.addedColumns.join(", ") || "-"}</span><span>- {item.removedColumns.join(", ") || "-"}</span><span>변경 {item.changedColumns.join(", ") || "-"}</span></article>)}</section> : null}
      <div className="sql-erd-workbench">
        <section className="advanced-panel erd-canvas-panel"><header><div><h2>Entity Relationship Diagram</h2><span>테이블을 선택하면 상세 컬럼과 FK를 확인합니다.</span></div></header><div className="erd-scroll-area"><svg role="img" aria-label="데이터베이스 ERD" width={940 * zoom / 100} height={canvasHeight * zoom / 100} viewBox={`0 0 940 ${canvasHeight}`}>
          <defs><marker id="erd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
          {model.tables.flatMap((table) => table.foreignKeys.map((foreignKey, index) => { const from = positions.find((position) => position.name.toLowerCase() === table.name.toLowerCase()); const to = positions.find((position) => position.name.toLowerCase() === foreignKey.referencedTable.toLowerCase()); if (!from || !to) return null; return <g className="erd-relation" key={`${table.name}:${foreignKey.referencedTable}:${index}`}><line x1={to.x + to.width / 2} y1={to.y + to.height / 2} x2={from.x + from.width / 2} y2={from.y + from.height / 2} markerEnd="url(#erd-arrow)" /><text x={(to.x + from.x) / 2 + 125} y={(to.y + from.y) / 2 + 10}>{foreignKey.columns.join(",")}</text></g>; }))}
          {model.tables.map((table) => { const position = positions.find((item) => item.name === table.name); if (!position) return null; return <g className={`erd-table${selectedTable?.name === table.name ? " selected" : ""}`} role="button" tabIndex={0} aria-label={`${table.name} 테이블 상세 보기`} key={table.name} onClick={() => setSelectedTableName(table.name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedTableName(table.name); }}><rect x={position.x} y={position.y} width={position.width} height={position.height} rx="12" /><rect className="erd-table-title" x={position.x} y={position.y} width={position.width} height="42" rx="12" /><text className="erd-table-name" x={position.x + 14} y={position.y + 27}>{table.name}</text>{table.columns.slice(0, 7).map((column, index) => <g key={column.name}><text className="erd-column-key" x={position.x + 13} y={position.y + 61 + index * 24}>{column.primaryKey ? "PK" : table.foreignKeys.some((key) => key.columns.includes(column.name)) ? "FK" : ""}</text><text className="erd-column-name" x={position.x + 45} y={position.y + 61 + index * 24}>{column.name}</text><text className="erd-column-type" x={position.x + 155} y={position.y + 61 + index * 24}>{column.type.slice(0, 15)}</text></g>)}{table.columns.length > 7 ? <text className="erd-more" x={position.x + 14} y={position.y + position.height - 8}>+ {table.columns.length - 7} columns</text> : null}</g>; })}
        </svg></div></section>
        <aside className="advanced-panel schema-table-detail"><header><div><h2>{selectedTable?.name ?? "Table"}</h2><span>{selectedTable?.columns.length ?? 0} columns · {selectedTable?.foreignKeys.length ?? 0} FK</span></div></header>{selectedTable ? <><div className="schema-column-list"><div><strong>Key</strong><strong>Column</strong><strong>Type</strong><strong>Null</strong></div>{selectedTable.columns.map((column) => <div key={column.name}><span>{column.primaryKey ? "PK" : selectedTable.foreignKeys.some((key) => key.columns.includes(column.name)) ? "FK" : column.unique ? "UK" : ""}</span><code>{column.name}</code><span>{column.type}</span><span>{column.nullable ? "YES" : "NO"}</span></div>)}</div><h3>Foreign Keys</h3>{selectedTable.foreignKeys.length > 0 ? <ul>{selectedTable.foreignKeys.map((key, index) => <li key={`${key.referencedTable}:${index}`}><code>{key.columns.join(", ")}</code><span>→</span><code>{key.referencedTable}({key.referencedColumns.join(", ")})</code></li>)}</ul> : <p>Foreign Key가 없습니다.</p>}</> : null}</aside>
      </div>
      <UtilityHelpDialog isOpen={helpOpen} title="SQL Schema · ERD Viewer" description="DDL 문자열을 테이블·컬럼·관계 그래프로 변환합니다." onClose={() => setHelpOpen(false)}><article><h3>지원 범위</h3><p>MySQL 중심의 CREATE TABLE, inline·table PK, UNIQUE, FOREIGN KEY, REFERENCES, NOT NULL, DEFAULT, AUTO_INCREMENT를 해석합니다.</p></article><article><h3>Formatter와 차이</h3><p>SQL Formatter는 문장을 정리하고, ERD Viewer는 DDL의 의미를 읽어 테이블 관계와 키 오류를 확인합니다.</p></article><article><h3>확장 포인트</h3><p>정확한 전체 SQL dialect 지원은 전용 SQL Parser가 필요합니다. 현재 구현은 학습과 빠른 구조 검토를 위한 경량 분석기입니다.</p></article></UtilityHelpDialog>
    </section>
  );
};
