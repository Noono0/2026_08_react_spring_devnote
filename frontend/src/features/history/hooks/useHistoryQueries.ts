/**
 * ============================================================================
 * useHistoryQueries.ts — 업무 History의 TanStack Query 훅 모음
 * ============================================================================
 *
 * [캐시 키를 "history"로 시작하게 한 이유]
 *   14단계 학습용 문서는 ["documents", ...] 키를 쓴다.
 *   업무 History까지 같은 키 아래에 있으면, 연습장에서 문서를 저장할 때
 *   포트폴리오 캐시도 함께 지워지는 식으로 서로 상관없는 화면이 영향을 주고받는다.
 *   맨 앞 키를 다르게 하면 두 기능의 캐시가 완전히 따로 움직인다.
 *
 * ★ 로그인·로그아웃할 때는 권한에 따라 보이는 글이 달라지므로
 *   features/auth/hooks/useAuthSession.ts의 resetAuthenticatedQueries가
 *   historyQueryKeys.all을 무효화한다. 키 이름을 바꾸면 그쪽도 함께 확인해야 한다.
 *
 * [키 계층]
 *   all     → ["history"]
 *   lists() → ["history", "list"]              ← 목록과 태그 개수 (글을 저장·삭제하면 함께 갱신)
 *   list()  → ["history", "list", { 검색조건 }]
 *   tags()  → ["history", "list", "tags"]
 *   detail()→ ["history", "detail", 42]
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHistory,
  deleteHistory,
  getHistoryDetail,
  getHistoryList,
  getHistoryTags,
  updateHistory,
} from "../api/historyApi";
import type { HistorySaveRequest, HistorySearchCondition } from "../types/historyTypes";

export const historyQueryKeys = {
  all: ["history"] as const,
  lists: () => [...historyQueryKeys.all, "list"] as const,
  list: (condition: HistorySearchCondition) => [...historyQueryKeys.lists(), condition] as const,
  // 태그 개수는 글이 바뀌면 함께 달라지므로 lists() 아래에 둔다. lists()를 무효화하면 태그도 새로 받는다.
  tags: () => [...historyQueryKeys.lists(), "tags"] as const,
  details: () => [...historyQueryKeys.all, "detail"] as const,
  detail: (documentId: number) => [...historyQueryKeys.details(), documentId] as const,
};

/** 【Read】 목록 조회. 페이지를 넘기는 동안 이전 목록을 유지해 화면이 깜빡이지 않게 한다. */
export const useHistoryListQuery = (condition: HistorySearchCondition) =>
  useQuery({
    queryKey: historyQueryKeys.list(condition),
    // TanStack Query가 만들어 준 signal을 넘기면, 조건이 바뀌거나 화면을 떠날 때 요청이 자동 취소된다.
    queryFn: ({ signal }) => getHistoryList(condition, signal),
    placeholderData: (previousData) => previousData,
  });

/**
 * 【Read】 상세 조회. 주소에서 꺼낸 번호가 올바른 양의 정수일 때만 요청한다.
 * (/history/바나나 같은 주소로 서버에 400 요청을 보내지 않으려는 것)
 */
export const useHistoryDetailQuery = (documentId: number | undefined) =>
  useQuery({
    // 번호가 없을 때의 0은 자리채움 값이다. enabled가 false라 실제로 요청되지 않는다.
    queryKey: historyQueryKeys.detail(documentId ?? 0),
    // enabled 조건을 통과해야만 실행되므로 이 시점의 documentId는 반드시 숫자다.
    queryFn: ({ signal }) => getHistoryDetail(documentId as number, signal),
    enabled: documentId !== undefined && Number.isSafeInteger(documentId) && documentId > 0,
  });

/** 【Read】 태그 필터용 태그 목록. */
export const useHistoryTagsQuery = () =>
  useQuery({
    queryKey: historyQueryKeys.tags(),
    queryFn: ({ signal }) => getHistoryTags(signal),
  });

/** 【Create】 작성. 새 글이 생기면 목록·태그 개수만 다시 받는다(기존 글 상세는 그대로). */
export const useCreateHistoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: HistorySaveRequest) => createHistory(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: historyQueryKeys.lists() });
    },
  });
};

/** 【Update】 수정. 서버가 돌려준 최신 글로 상세 캐시를 바로 채우고, 목록은 다시 받는다. */
export const useUpdateHistoryMutation = (documentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: HistorySaveRequest) => updateHistory(documentId, request),
    onSuccess: async (updatedHistory) => {
      queryClient.setQueryData(historyQueryKeys.detail(documentId), updatedHistory);
      await queryClient.invalidateQueries({ queryKey: historyQueryKeys.lists() });
    },
  });
};

/** 【Delete】 삭제. 지워진 글의 상세 캐시가 남지 않도록 목록·상세를 모두 무효화한다. */
export const useDeleteHistoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => deleteHistory(documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: historyQueryKeys.all });
    },
  });
};
