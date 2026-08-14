import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { Snippet, SnippetPageResponse, SnippetSaveRequest, SnippetSearchCondition } from "@/features/utility/types/snippetTypes";

export const getSnippets = async (condition: SnippetSearchCondition): Promise<SnippetPageResponse> =>
  (await selectedHttpClient.get<ApiResponse<SnippetPageResponse>>("/snippets", { queryParameters: condition })).data;
export const createSnippet = async (request: SnippetSaveRequest): Promise<Snippet> =>
  (await selectedHttpClient.post<SnippetSaveRequest, ApiResponse<Snippet>>("/snippets", request)).data;
export const updateSnippet = async (snippetId: number, request: SnippetSaveRequest): Promise<Snippet> =>
  (await selectedHttpClient.put<SnippetSaveRequest, ApiResponse<Snippet>>(`/snippets/${snippetId}`, request)).data;
export const deleteSnippet = async (snippetId: number): Promise<void> => { await selectedHttpClient.delete<ApiResponse<void>>(`/snippets/${snippetId}`); };
export const restoreSnippet = async (snippetId: number): Promise<Snippet> =>
  (await selectedHttpClient.post<Record<string, never>, ApiResponse<Snippet>>(`/snippets/${snippetId}/restore`, {})).data;
export const bulkDeleteSnippets = async (snippetIds: number[]): Promise<number> =>
  (await selectedHttpClient.post<{ snippetIds: number[] }, ApiResponse<number>>("/snippets/bulk-delete", { snippetIds })).data;
export const bulkRestoreSnippets = async (snippetIds: number[]): Promise<number> =>
  (await selectedHttpClient.post<{ snippetIds: number[] }, ApiResponse<number>>("/snippets/bulk-restore", { snippetIds })).data;

