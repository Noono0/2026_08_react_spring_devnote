// useSnippetQueries.ts — 코드 조각 보관함 서버 상태 훅. 로그인하지 않았으면(enabled=false) 목록을 요청하지 않는다.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bulkDeleteSnippets, bulkRestoreSnippets, createSnippet, deleteSnippet, getSnippets, restoreSnippet, updateSnippet } from "@/features/utility/api/snippetApi";
import type { SnippetSaveRequest, SnippetSearchCondition } from "@/features/utility/types/snippetTypes";

const snippetQueryKey = ["developer-snippets"] as const;

export const useSnippetsQuery = (condition: SnippetSearchCondition, enabled: boolean) => useQuery({
  queryKey: [...snippetQueryKey, condition], queryFn: () => getSnippets(condition), enabled, placeholderData: (previousData) => previousData,
});

/** 변경 훅 공통 틀: 성공하면 코드 조각 목록 캐시를 무효화한다. 제네릭으로 인자·결과 타입을 그대로 이어받는다. */
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

