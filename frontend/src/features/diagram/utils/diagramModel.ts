/**
 * ============================================================================
 * diagramModel.ts — 다이어그램 모델 변환 (SQL ↔ ERD)
 * ============================================================================
 *
 * ★ 이 파일이 이번 기능의 핵심 로직이다. 그리고 전부 순수 함수다.
 *   화면 없이 테스트할 수 있고, 서버도 필요 없다.
 *   (diagramModel.test.ts 에서 검증한다)
 *
 * [기존 자산 재사용]
 *   DDL을 파싱하는 analyzeSqlSchema 는 이미 utility/utils/sqlSchemaAnalyzer.ts 에 있다.
 *   새로 만들지 않고 그대로 가져다 쓴다. 여기서는 그 결과(SqlSchemaModel)를
 *   편집기가 쓰는 DiagramModel 로 바꾸는 일만 한다.
 *
 *   SQL DDL ──analyzeSqlSchema()──▶ SqlSchemaModel ──convertSqlSchemaToDiagramModel()──▶ DiagramModel
 *   DiagramModel ──generateCreateTableSql()──▶ SQL DDL
 */

import type { SqlSchemaModel } from "@/features/utility/utils/sqlSchemaAnalyzer";
import type { DiagramColumn, DiagramEdge, DiagramModel, DiagramNode } from "../types/diagramTypes";

/** 빈 다이어그램. 새로 만들기 화면의 초기값이다. */
export const createEmptyDiagramModel = (): DiagramModel => ({
  modelVersion: 1,
  nodes: [],
  edges: [],
});

/**
 * 저장된 JSON 문자열을 안전하게 모델로 되돌린다.
 *
 * ★ JSON.parse 를 그냥 쓰지 않는 이유
 *   서버에 저장된 값이 깨졌거나, 예전 구조로 저장된 것일 수 있다.
 *   그대로 믿고 쓰면 편집기가 통째로 죽는다.
 *   파싱에 실패하거나 모양이 이상하면 빈 다이어그램으로 시작한다.
 *   (shared/config/dataSourceSelection.ts 에서 localStorage 를 다룰 때와 같은 원칙)
 */
export const parseDiagramModel = (diagramModelJson: string): DiagramModel => {
  try {
    const parsed: unknown = JSON.parse(diagramModelJson);
    if (typeof parsed !== "object" || parsed === null) {
      return createEmptyDiagramModel();
    }
    const candidate = parsed as Partial<DiagramModel>;
    if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
      return createEmptyDiagramModel();
    }
    return {
      modelVersion: 1,
      nodes: candidate.nodes,
      edges: candidate.edges,
    };
  } catch {
    return createEmptyDiagramModel();
  }
};

/** 모델을 저장용 문자열로 만든다. */
export const stringifyDiagramModel = (diagramModel: DiagramModel): string =>
  JSON.stringify(diagramModel);

/**
 * 테이블을 격자로 배치할 때 쓰는 값.
 * 자동 배치 알고리즘(force-directed 등)을 쓸 수도 있지만,
 * 예측 가능하고 코드가 단순한 격자 배치가 학습용으로 더 낫다고 판단했다.
 */
const GRID_COLUMN_COUNT = 3;
const GRID_HORIZONTAL_GAP = 320;
const GRID_VERTICAL_GAP = 260;

/**
 * ★ SQL 스키마 분석 결과 → 편집기 모델.
 *
 * 기존 파서가 뽑아낸 테이블/컬럼/외래키를 노드와 엣지로 옮긴다.
 * 좌표 정보는 DDL에 없으므로 격자로 자동 배치하고,
 * 그 뒤로는 사용자가 드래그해서 옮긴 위치가 저장된다.
 */
export const convertSqlSchemaToDiagramModel = (sqlSchemaModel: SqlSchemaModel): DiagramModel => {
  const nodes: DiagramNode[] = sqlSchemaModel.tables.map((table, tableIndex) => ({
    nodeId: table.name,
    tableName: table.name,
    position: {
      x: (tableIndex % GRID_COLUMN_COUNT) * GRID_HORIZONTAL_GAP,
      y: Math.floor(tableIndex / GRID_COLUMN_COUNT) * GRID_VERTICAL_GAP,
    },
    columns: table.columns.map((column): DiagramColumn => ({
      columnName: column.name,
      columnType: column.type,
      primaryKey: column.primaryKey,
      nullable: column.nullable,
    })),
  }));

  // 노드로 만들어진 테이블 이름을 모아 둔다.
  // 외래키가 가리키는 테이블이 DDL에 없을 수도 있어(부분 DDL 붙여넣기 등)
  // 존재하는 테이블끼리의 관계만 엣지로 만든다.
  const existingTableNames = new Set(nodes.map((node) => node.nodeId));

  const edges: DiagramEdge[] = [];
  sqlSchemaModel.tables.forEach((table) => {
    table.foreignKeys.forEach((foreignKey, foreignKeyIndex) => {
      if (!existingTableNames.has(foreignKey.referencedTable)) {
        return;
      }
      // 복합 외래키는 컬럼이 여러 개다. 첫 컬럼을 대표로 표시한다.
      // (화면에 선을 여러 개 겹쳐 그리면 오히려 알아보기 어렵다)
      edges.push({
        edgeId: `${table.name}-${foreignKey.referencedTable}-${foreignKeyIndex}`,
        sourceNodeId: table.name,
        targetNodeId: foreignKey.referencedTable,
        sourceColumnName: foreignKey.columns[0] ?? "",
        targetColumnName: foreignKey.referencedColumns[0] ?? "",
      });
    });
  });

  return { modelVersion: 1, nodes, edges };
};

/** SQL 예약어나 특수문자가 섞인 이름을 백틱으로 감싼다. */
const quoteSqlIdentifier = (identifier: string): string => `\`${identifier.replace(/`/g, "")}\``;

/**
 * ★ 편집기 모델 → CREATE TABLE DDL (역방향 생성).
 *
 * 화면에서 그린 ERD를 실제 SQL로 뽑아낸다.
 * 생성 결과를 기존 SQL Formatter나 SQL Schema ERD 화면에 다시 붙여넣을 수 있어
 * "ERD로 설계 → DDL 생성 → 검토" 흐름이 만들어진다.
 *
 * [의도적으로 지원하지 않는 것]
 *   인덱스, 기본값, CHECK 제약, 파티션 등은 편집기 모델에 없으므로 생성하지 않는다.
 *   ERD의 목적은 "구조 설계"이지 완전한 마이그레이션 스크립트 작성이 아니라고 보았다.
 *   실제 운영 DDL은 생성 결과를 출발점으로 삼아 손보는 것을 전제로 한다.
 */
export const generateCreateTableSql = (diagramModel: DiagramModel): string => {
  if (diagramModel.nodes.length === 0) {
    return "-- 테이블이 없습니다. 먼저 테이블을 추가해 주세요.";
  }

  const statements = diagramModel.nodes.map((node) => {
    const columnLines = node.columns.map((column) => {
      const parts = [
        `    ${quoteSqlIdentifier(column.columnName)}`,
        column.columnType || "VARCHAR(255)",
      ];
      // PK는 아래에서 따로 PRIMARY KEY 절로 묶으므로 여기서는 NOT NULL 만 붙인다.
      if (!column.nullable || column.primaryKey) {
        parts.push("NOT NULL");
      }
      return parts.join(" ");
    });

    const primaryKeyColumns = node.columns
      .filter((column) => column.primaryKey)
      .map((column) => quoteSqlIdentifier(column.columnName));
    if (primaryKeyColumns.length > 0) {
      columnLines.push(`    PRIMARY KEY (${primaryKeyColumns.join(", ")})`);
    }

    // 이 테이블에서 나가는 관계를 FOREIGN KEY 절로 만든다.
    diagramModel.edges
      .filter((edge) => edge.sourceNodeId === node.nodeId)
      .forEach((edge) => {
        const targetNode = diagramModel.nodes.find((candidate) => candidate.nodeId === edge.targetNodeId);
        if (!targetNode || !edge.sourceColumnName || !edge.targetColumnName) {
          return;
        }
        columnLines.push(
          `    CONSTRAINT ${quoteSqlIdentifier(`fk_${node.tableName}_${targetNode.tableName}`)}`
          + ` FOREIGN KEY (${quoteSqlIdentifier(edge.sourceColumnName)})`
          + ` REFERENCES ${quoteSqlIdentifier(targetNode.tableName)} (${quoteSqlIdentifier(edge.targetColumnName)})`,
        );
      });

    return `CREATE TABLE ${quoteSqlIdentifier(node.tableName)} (\n${columnLines.join(",\n")}\n);`;
  });

  return statements.join("\n\n");
};

/** 새 테이블 노드를 만든다. 이름이 겹치지 않도록 번호를 붙인다. */
export const createNewTableNode = (diagramModel: DiagramModel): DiagramNode => {
  const existingNames = new Set(diagramModel.nodes.map((node) => node.tableName));
  let tableIndex = diagramModel.nodes.length + 1;
  let tableName = `NEW_TABLE_${tableIndex}`;
  while (existingNames.has(tableName)) {
    tableIndex += 1;
    tableName = `NEW_TABLE_${tableIndex}`;
  }

  return {
    nodeId: `node-${Date.now()}`,
    tableName,
    // 새 테이블은 기존 것들과 겹치지 않게 격자 다음 자리에 놓는다.
    position: {
      x: (diagramModel.nodes.length % GRID_COLUMN_COUNT) * GRID_HORIZONTAL_GAP,
      y: Math.floor(diagramModel.nodes.length / GRID_COLUMN_COUNT) * GRID_VERTICAL_GAP,
    },
    columns: [
      { columnName: "id", columnType: "BIGINT", primaryKey: true, nullable: false },
    ],
  };
};
