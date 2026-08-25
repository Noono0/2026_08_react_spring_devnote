/**
 * ============================================================================
 * useDiagramQueries.ts — 다이어그램 TanStack Query 훅
 * ============================================================================
 *
 * useDocumentQueries.ts 와 같은 Query Key Factory 패턴을 쓴다.
 * 키를 한 곳에서만 만들기 때문에 오타로 캐시가 어긋나는 일이 없다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDiagram,
  deleteDiagram,
  getDiagramDetail,
  getDiagramList,
  getDiagramVersion,
  getDiagramVersionList,
  restoreDiagramVersion,
  updateDiagram,
} from "../api/diagramApi";
import type { DiagramSaveRequest, DiagramSearchCondition } from "../types/diagramTypes";

/**
 * 캐시 키 공장. 계층 구조라 상위 키로 하위를 한꺼번에 무효화할 수 있다.
 *   all      → ["diagrams"]
 *   lists()  → ["diagrams", "list"]
 *   detail() → ["diagrams", "detail", 42]
 *   versions()→ ["diagrams", "versions", 42]
 */
export const diagramQueryKeys = {
  all: ["diagrams"] as const,
  lists: () => [...diagramQueryKeys.all, "list"] as const,
  list: (condition: DiagramSearchCondition) => [...diagramQueryKeys.lists(), condition] as const,
  details: () => [...diagramQueryKeys.all, "detail"] as const,
  detail: (diagramId: number) => [...diagramQueryKeys.details(), diagramId] as const,
  versions: (diagramId: number) => [...diagramQueryKeys.all, "versions", diagramId] as const,
  version: (diagramId: number, versionNumber: number) =>
    [...diagramQueryKeys.versions(diagramId), versionNumber] as const,
};

/** 목록 조회. 페이지를 넘길 때 화면이 깜빡이지 않도록 이전 데이터를 유지한다. */
export const useDiagramListQuery = (searchCondition: DiagramSearchCondition) =>
  useQuery({
    queryKey: diagramQueryKeys.list(searchCondition),
    queryFn: ({ signal }) => getDiagramList(searchCondition, signal),
    placeholderData: (previousData) => previousData,
  });

/**
 * 상세 조회.
 * diagramId 가 확정되지 않았으면(주소가 이상하거나 새 다이어그램) 요청하지 않는다.
 */
export const useDiagramDetailQuery = (diagramId: number | undefined) =>
  useQuery({
    queryKey: diagramQueryKeys.detail(diagramId ?? 0),
    queryFn: ({ signal }) => getDiagramDetail(diagramId as number, signal),
    enabled: diagramId !== undefined && Number.isSafeInteger(diagramId) && diagramId > 0,
  });

export const useDiagramVersionListQuery = (diagramId: number | undefined) =>
  useQuery({
    queryKey: diagramQueryKeys.versions(diagramId ?? 0),
    queryFn: ({ signal }) => getDiagramVersionList(diagramId as number, signal),
    enabled: diagramId !== undefined && Number.isSafeInteger(diagramId) && diagramId > 0,
  });

/** 특정 버전의 모델까지 조회한다. 미리보기를 열 때만 사용한다. */
export const useDiagramVersionQuery = (diagramId: number | undefined, versionNumber: number | undefined) =>
  useQuery({
    queryKey: diagramQueryKeys.version(diagramId ?? 0, versionNumber ?? 0),
    queryFn: ({ signal }) => getDiagramVersion(diagramId as number, versionNumber as number, signal),
    enabled:
      diagramId !== undefined && diagramId > 0
      && versionNumber !== undefined && versionNumber > 0,
  });

export const useCreateDiagramMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saveRequest: DiagramSaveRequest) => createDiagram(saveRequest),
    onSuccess: async () => {
      // 새 다이어그램이 생겼으니 목록만 다시 받으면 된다.
      await queryClient.invalidateQueries({ queryKey: diagramQueryKeys.lists() });
    },
  });
};

export const useUpdateDiagramMutation = (diagramId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saveRequest: DiagramSaveRequest) => updateDiagram(diagramId, saveRequest),
    onSuccess: async (updatedDiagram) => {
      // 서버가 최신 상태를 돌려줬으므로 상세 캐시는 그대로 채워 넣는다(재요청 불필요).
      queryClient.setQueryData(diagramQueryKeys.detail(diagramId), updatedDiagram);
      // 목록의 제목·수정일과 버전 목록은 달라졌을 수 있으니 다시 받는다.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: diagramQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: diagramQueryKeys.versions(diagramId) }),
      ]);
    },
  });
};

export const useDeleteDiagramMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (diagramId: number) => deleteDiagram(diagramId),
    onSuccess: async () => {
      // 삭제된 다이어그램의 상세 캐시가 남아 있으면 뒤로가기로 접근했을 때
      // 이미 없는 데이터가 보인다. 목록·상세를 모두 무효화한다.
      await queryClient.invalidateQueries({ queryKey: diagramQueryKeys.all });
    },
  });
};

export const useRestoreDiagramVersionMutation = (diagramId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionNumber: number) => restoreDiagramVersion(diagramId, versionNumber),
    onSuccess: async (restoredDiagram) => {
      queryClient.setQueryData(diagramQueryKeys.detail(diagramId), restoredDiagram);
      await queryClient.invalidateQueries({ queryKey: diagramQueryKeys.all });
    },
  });
};
