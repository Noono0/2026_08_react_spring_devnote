/**
 * ============================================================================
 * DiagramCanvas.tsx — React Flow 캔버스 (드래그 편집 + 이미지 Export)
 * ============================================================================
 *
 * [역할 분리]
 *   이 컴포넌트는 "그리고 드래그하는" 일만 한다.
 *   저장·불러오기·SQL 변환 같은 건 부모(DiagramEditorPage)가 맡는다.
 *   덕분에 이 컴포넌트는 서버를 전혀 모르고, 테스트하거나 재사용하기 쉽다.
 *
 * [부모와의 소통]
 *   부모 → 자식 : diagramModel (그릴 내용)
 *   자식 → 부모 : handleModelChange (노드를 옮겼을 때 알림)
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
// React Flow는 자체 CSS가 필요하다. 이걸 빼먹으면 노드가 겹쳐 보인다.
import "@xyflow/react/dist/style.css";
import { TableNode } from "./TableNode";
import type { DiagramModel } from "../types/diagramTypes";

interface DiagramCanvasProperties {
  diagramModel: DiagramModel;
  handleModelChange: (nextModel: DiagramModel) => void;
  /** 읽기 전용 모드. 버전 미리보기에서 사용한다. */
  readOnly?: boolean;
  /** PNG/SVG 내보내기에서 캔버스 DOM을 잡기 위한 ref */
  canvasReference?: React.RefObject<HTMLDivElement | null>;
}

/**
 * ★ nodeTypes 를 컴포넌트 바깥에 둔 이유가 중요하다.
 *   안에 두면 렌더링할 때마다 새 객체가 만들어지고,
 *   React Flow는 "노드 타입이 바뀌었다"고 판단해 캔버스 전체를 다시 그린다.
 *   드래그가 뚝뚝 끊기는 대표적인 원인이라 공식 문서도 바깥에 두라고 안내한다.
 */
const nodeTypes = { tableNode: TableNode };

export const DiagramCanvas = ({
  diagramModel,
  handleModelChange,
  readOnly = false,
  canvasReference,
}: DiagramCanvasProperties) => {
  // 우리 모델(DiagramModel) → React Flow가 이해하는 모양으로 변환한다.
  const initialNodes = useMemo<Node[]>(
    () => diagramModel.nodes.map((node) => ({
      id: node.nodeId,
      type: "tableNode",
      position: node.position,
      data: { tableName: node.tableName, columns: node.columns },
    })),
    [diagramModel.nodes],
  );

  const initialEdges = useMemo<Edge[]>(
    () => diagramModel.edges.map((edge) => ({
      id: edge.edgeId,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      label: `${edge.sourceColumnName} → ${edge.targetColumnName}`,
      // 곡선 타입. ERD에서는 직선보다 관계를 따라가기 쉽다.
      type: "smoothstep",
    })),
    [diagramModel.edges],
  );

  // React Flow가 드래그 중 위치를 자체적으로 관리하도록 전용 훅을 쓴다.
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 부모가 모델을 갈아끼우면(불러오기, SQL 변환, 버전 복원) 캔버스도 맞춰 준다.
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  /**
   * 드래그가 끝났을 때만 부모에게 알린다.
   *
   * ★ onNodesChange 마다 알리면 마우스를 움직이는 내내 부모가 다시 렌더링되어
   *   화면이 심하게 버벅인다. "끝났을 때 한 번"이 훨씬 가볍다.
   */
  const syncModelFromCanvas = useCallback(() => {
    handleModelChange({
      modelVersion: 1,
      nodes: nodes.map((node) => {
        const nodeData = node.data as { tableName: string; columns: DiagramModel["nodes"][number]["columns"] };
        return {
          nodeId: node.id,
          tableName: nodeData.tableName,
          position: node.position,
          columns: nodeData.columns,
        };
      }),
      edges: edges.map((edge) => {
        // 라벨에서 컬럼명을 되돌린다. 원래 모델에 있으면 그 값을 우선 사용한다.
        const originalEdge = diagramModel.edges.find((candidate) => candidate.edgeId === edge.id);
        return {
          edgeId: edge.id,
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          sourceColumnName: originalEdge?.sourceColumnName ?? "",
          targetColumnName: originalEdge?.targetColumnName ?? "",
        };
      }),
    });
  }, [nodes, edges, diagramModel.edges, handleModelChange]);

  /** 사용자가 두 노드를 이어 새 관계를 만들었을 때. */
  const handleConnect = useCallback((connection: Connection) => {
    setEdges((currentEdges) => addEdge({ ...connection, type: "smoothstep" }, currentEdges));
  }, [setEdges]);

  const internalReference = useRef<HTMLDivElement>(null);
  const containerReference = canvasReference ?? internalReference;

  return (
    <div className="erd-canvas-container" ref={containerReference}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : handleConnect}
        // 드래그·연결이 끝나는 시점에만 부모에게 알린다.
        onNodeDragStop={readOnly ? undefined : syncModelFromCanvas}
        onEdgesDelete={readOnly ? undefined : syncModelFromCanvas}
        onNodesDelete={readOnly ? undefined : syncModelFromCanvas}
        nodeTypes={nodeTypes}
        // 처음 열 때 모든 노드가 보이도록 자동으로 확대/축소를 맞춘다.
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        // 접근성: 캔버스가 무엇인지 화면 낭독기에 알린다.
        aria-label="다이어그램 편집 캔버스"
        proOptions={{ hideAttribution: false }}
      >
        <Background />
        <Controls showInteractive={!readOnly} />
        {/* 테이블이 많아지면 전체 위치를 파악하기 어려워 미니맵을 둔다. */}
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
};
