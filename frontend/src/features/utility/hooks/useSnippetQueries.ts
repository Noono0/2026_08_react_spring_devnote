import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bulkDeleteSnippets, bulkRestoreSnippets, createSnippet, deleteSnippet, getSnippets, restoreSnippet, updateSnippet } from "@/features/utility/api/snippetApi";
import type { SnippetSaveRequest, SnippetSearchCondition } from "@/features/utility/types/snippetTypes";

const snippetQueryKey = ["developer-snippets"] as const;

export const useSnippetsQuery = (condition: SnippetSearchCondition, enabled: boolean) => useQuery({
  queryKey: [...snippetQueryKey, condition], queryFn: () => getSnippets(condition), enabled, placeholderData: (previousData) => previousData,
});

const useInvalidatingMutation = <TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: async () => queryClient.invalidateQueries({ queryKey: snippetQueryKey }) });
};

export const useCreateSnippetMutation = () => useInvalidatingMutation(createSnippet);
export const useUpdateSnippetMutation = () => useInvalidatingMutation(({ snippetId, request }: { snippetId: number; request: SnippetSaveRequest }) => updateSnippet(snippetId, request));
export const useDeleteSnippetMutation = () => useInvalidatingMutation(deleteSnippet);
export const useRestoreSnippetMutation = () => useInvalidatingMutation(restoreSnippet);
export const useBulkDeleteSnippetsMutation = () => useInvalidatingMutation(bulkDeleteSnippets);
export const useBulkRestoreSnippetsMutation = () => useInvalidatingMutation(bulkRestoreSnippets);

