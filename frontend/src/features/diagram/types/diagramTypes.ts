/**
 * ============================================================================
 * diagramTypes.ts — 다이어그램 기능의 타입 (프론트·백엔드 계약서)
 * ============================================================================
 *
 * [설계 메모 — 왜 모델을 "JSON 문자열"로 주고받는가]
 *   백엔드의 diagram_model 컬럼은 JSON 이지만, API로는 문자열(diagramModelJson)로 오간다.
 *   백엔드는 이 안의 노드·엣지 구조를 전혀 해석하지 않고 "유효한 JSON 인가"만 검사한다.
 *
 *   덕분에 편집기 모델을 바꿔도 서버 코드를 고칠 필요가 없다.
 *   대신 파싱과 검증은 프론트엔드 책임이므로 parseDiagramModel 로 안전하게 읽는다.
 */

/** 다이어그램 종류. 백엔드 DiagramType enum 과 값이 정확히 같아야 한다. */
export type DiagramType = "ERD" | "FLOWCHART" | "UML" | "SYSTEM" | "GENERAL";

/** 테이블(노드) 안의 컬럼 한 줄. */
export interface DiagramColumn {
  columnName: string;
  columnType: string;
  primaryKey: boolean;
  nullable: boolean;
}

/** 편집기의 노드 하나 = ERD의 테이블 하나. */
export interface DiagramNode {
  nodeId: string;
  tableName: string;
  /** 캔버스 좌표. React Flow가 드래그할 때마다 갱신한다. */
  position: { x: number; y: number };
  columns: DiagramColumn[];
}

/** 노드 사이의 연결 = 외래키 관계. */
export interface DiagramEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceColumnName: string;
  targetColumnName: string;
}

/**
 * 저장되는 다이어그램 모델 전체.
 *
 * `modelVersion`을 둔 이유: 나중에 구조를 바꿀 때
 * 기존에 저장된 데이터를 어떻게 읽을지 판단할 근거가 필요하다.
 * 이게 없으면 구조를 바꾸는 순간 예전 다이어그램을 열 수 없게 된다.
 */
export interface DiagramModel {
  modelVersion: 1;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

// ── API 응답 타입 (백엔드 record 와 1:1) ────────────────────────────

/** 목록 항목. 모델 JSON이 없다는 점에 주의 — 응답 크기를 줄이기 위해 서버가 뺀다. */
export interface DiagramListItem {
  diagramId: number;
  diagramTitle: string;
  diagramDescription: string;
  diagramType: DiagramType;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramDetail {
  diagramId: number;
  diagramTitle: string;
  diagramDescription: string;
  diagramType: DiagramType;
  diagramModelJson: string;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
}

/** 버전 정보. 목록 조회 시 diagramModelJson 은 null 로 온다. */
export interface DiagramVersion {
  diagramVersionId: number;
  diagramId: number;
  versionNumber: number;
  diagramTitle: string;
  diagramType: DiagramType;
  diagramModelJson: string | null;
  changeSummary: string | null;
  createdAt: string;
}

/** 저장 요청. versionNumber 는 수정할 때만 보낸다(낙관적 잠금). */
export interface DiagramSaveRequest {
  diagramTitle: string;
  diagramDescription: string;
  diagramType: DiagramType;
  diagramModelJson: string;
  changeSummary?: string;
  versionNumber?: number;
}

export interface DiagramSearchCondition {
  searchKeyword: string;
  diagramType?: DiagramType;
  pageNumber: number;
  pageSize: number;
}

/** 목록 API 응답. 문서 기능의 PageResponse 와 같은 모양이다. */
export interface DiagramListResponse {
  content: DiagramListItem[];
  pageInformation: {
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    firstPage: boolean;
    lastPage: boolean;
  };
}
