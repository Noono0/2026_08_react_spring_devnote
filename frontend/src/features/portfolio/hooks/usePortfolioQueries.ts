/**
 * usePortfolioQueries.ts — 포트폴리오 섹션 서버 상태(TanStack Query) 훅
 *
 * 조회는 useQuery, 생성·수정·삭제는 useMutation.
 * 변경이 성공하면 invalidateQueries로 섹션 목록을 "오래됨"으로 표시 → 화면이 자동으로 다시 받아 최신 상태가 된다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioSection,
  deletePortfolioSection,
  getPortfolioSections,
  updatePortfolioSection,
} from "@/features/portfolio/api/portfolioApi";
import type { PortfolioSectionSaveRequest } from "@/features/portfolio/types/portfolioTypes";

// 캐시 이름표. 조회와 무효화가 같은 키를 써야 하므로 상수로 한 곳에 둔다.
const sectionQueryKey = ["portfolio", "sections"] as const;
export const usePortfolioSectionsQuery = () => useQuery({ queryKey: sectionQueryKey, queryFn: getPortfolioSections });

export const useCreatePortfolioSectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createPortfolioSection, onSuccess: async () => queryClient.invalidateQueries({ queryKey: sectionQueryKey }) });
};

export const useUpdatePortfolioSectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    // mutationFn은 인자를 하나만 받으므로 번호와 요청 본문을 객체로 묶어 받는다.
    mutationFn: ({ id, request }: { id: number; request: PortfolioSectionSaveRequest }) => updatePortfolioSection(id, request),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: sectionQueryKey }),
  });
};

export const useDeletePortfolioSectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) => deletePortfolioSection(id, version),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: sectionQueryKey }),
  });
};
