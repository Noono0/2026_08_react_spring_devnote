import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioSection,
  deletePortfolioSection,
  getPortfolioSections,
  updatePortfolioSection,
} from "@/features/portfolio/api/portfolioApi";
import type { PortfolioSectionSaveRequest } from "@/features/portfolio/types/portfolioTypes";

const sectionQueryKey = ["portfolio", "sections"] as const;
export const usePortfolioSectionsQuery = () => useQuery({ queryKey: sectionQueryKey, queryFn: getPortfolioSections });

export const useCreatePortfolioSectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createPortfolioSection, onSuccess: async () => queryClient.invalidateQueries({ queryKey: sectionQueryKey }) });
};

export const useUpdatePortfolioSectionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
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
