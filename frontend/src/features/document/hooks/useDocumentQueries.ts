import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDocument,
  deleteDocument,
  getDocumentDetail,
  getDocumentList,
  updateDocument,
} from "../api/documentApi";
import type { DocumentSaveRequest, DocumentSearchCondition } from "../types/documentTypes";

export const documentQueryKeys = {
  all: ["documents"] as const,
  lists: () => [...documentQueryKeys.all, "list"] as const,
  list: (condition: DocumentSearchCondition, history: boolean) => [...documentQueryKeys.lists(), history ? "history" : "practice", condition] as const,
  details: () => [...documentQueryKeys.all, "detail"] as const,
  detail: (documentId: number, history: boolean) => [...documentQueryKeys.details(), history ? "history" : "practice", documentId] as const,
};

export const useDocumentListQuery = (condition: DocumentSearchCondition, history = false) =>
  useQuery({
    queryKey: documentQueryKeys.list(condition, history),
    queryFn: ({ signal }) => getDocumentList(condition, signal, history),
    placeholderData: (previousData) => previousData,
  });

export const useDocumentDetailQuery = (documentId: number | undefined, history = false) =>
  useQuery({
    queryKey: documentQueryKeys.detail(documentId ?? 0, history),
    queryFn: ({ signal }) => getDocumentDetail(documentId as number, signal, history),
    enabled: documentId !== undefined && Number.isSafeInteger(documentId) && documentId > 0,
  });

export const useCreateDocumentMutation = (history = false) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DocumentSaveRequest) => createDocument(request, history),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentQueryKeys.lists() });
    },
  });
};

export const useUpdateDocumentMutation = (documentId: number, history = false) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: DocumentSaveRequest) => updateDocument(documentId, request, history),
    onSuccess: async (updatedDocument) => {
      queryClient.setQueryData(documentQueryKeys.detail(documentId, history), updatedDocument);
      await queryClient.invalidateQueries({ queryKey: documentQueryKeys.lists() });
    },
  });
};

export const useDeleteDocumentMutation = (history = false) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => deleteDocument(documentId, history),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentQueryKeys.all });
    },
  });
};
