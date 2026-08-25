/**
 * ============================================================================
 * TableNode.tsx — ERD의 테이블 한 개를 그리는 React Flow 커스텀 노드
 * ============================================================================
 *
 * [커스텀 노드가 뭔가요?]
 *   React Flow는 기본으로 "네모에 글자 하나" 노드만 그려 준다.
 *   ERD처럼 테이블명 + 컬럼 목록을 보여주려면 직접 컴포넌트를 만들어
 *   "이 타입의 노드는 이렇게 그려라"라고 등록해야 한다.
 *   (등록은 DiagramCanvas 의 nodeTypes 에서 한다)
 *
 * ★ 이 컴포넌트는 평범한 React 컴포넌트다.
 *   그래서 프로젝트의 CSS 변수와 다크모드가 그대로 적용된다.
 *   draw.io 같은 iframe 방식이었다면 불가능했을 부분이다.
 */

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DiagramColumn } from "../types/diagramTypes";

/** React Flow가 node.data 로 넘겨주는 값의 모양. */
export interface TableNodeData extends Record<string, unknown> {
  tableName: string;
  columns: DiagramColumn[];
  /** 선택된 노드를 시각적으로 강조하기 위한 표시 */
  highlighted?: boolean;
}

export const TableNode = ({ data, selected }: NodeProps) => {
  const tableData = data as TableNodeData;

  return (
    <div className={`erd-table-node${selected ? " erd-table-node-selected" : ""}`}>
      {/*
        Handle = 엣지(연결선)가 붙는 지점.
        좌우 양쪽에 두어 테이블이 어느 방향에 있든 선이 자연스럽게 이어지게 한다.
        type="target"은 들어오는 선, type="source"는 나가는 선이다.
      */}
      <Handle type="target" position={Position.Left} className="erd-table-handle" />

      <div className="erd-table-node-title">{tableData.tableName}</div>

      <ul className="erd-table-node-columns">
        {tableData.columns.map((column) => (
          <li key={column.columnName} className={column.primaryKey ? "erd-column-primary" : undefined}>
            {/* 기본키 표시. 아이콘만으로는 화면 낭독기가 알 수 없어 title 도 붙인다. */}
            {column.primaryKey ? <span className="erd-column-key" title="기본키">PK</span> : null}
            <span className="erd-column-name">{column.columnName}</span>
            <span className="erd-column-type">{column.columnType}</span>
            {/* NULL 허용 여부는 설계 검토에서 중요한 정보라 함께 표시한다. */}
            {!column.nullable && !column.primaryKey ? (
              <span className="erd-column-flag" title="NOT NULL">*</span>
            ) : null}
          </li>
        ))}
        {tableData.columns.length === 0 ? (
          <li className="erd-column-empty">컬럼이 없습니다</li>
        ) : null}
      </ul>

      <Handle type="source" position={Position.Right} className="erd-table-handle" />
    </div>
  );
};
