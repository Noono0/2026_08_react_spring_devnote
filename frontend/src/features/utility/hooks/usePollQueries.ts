/**
 * usePollQueries.ts — 토픽 투표 서버 상태 훅
 * 투표·생성·수정·상태 변경·삭제가 성공하면 ["polls"]로 시작하는 모든 목록 캐시를 무효화해 다시 받는다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPoll, deletePoll, getPolls, updatePoll, updatePollStatus, votePoll } from "@/features/utility/api/pollApi";
import type { PollDefinitionRequest, PollSearchCondition, PollStatus } from "@/features/utility/types/pollTypes";

const pollQueryKey = ["polls"] as const;

// 다른 사람이 참여한 결과와 자동 종료 상태를 짧은 간격으로 갱신합니다.
export const usePollsQuery = (condition: PollSearchCondition, viewerScope: string) => useQuery({
  // 응답의 수정·삭제 권한은 현재 로그인 회원에 따라 달라지므로 회원 범위를 queryKey에 포함합니다.
  queryKey: [...pollQueryKey, viewerScope, condition],
  queryFn: () => getPolls(condition),
  // 조건이 바뀌어 새로 받는 동안 이전 목록을 계속 보여 준다(페이지를 넘길 때 화면이 비었다 채워지는 깜빡임 방지).
  placeholderData: (previousData) => previousData,
  // 5초마다 다시 받아 다른 사람의 투표·마감 시각 도달을 반영한다(실시간 연결 없이 주기적으로 묻는 "폴링").
  refetchInterval: 5_000,
});

export const useVotePollMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pollId, optionIds }: { pollId: number; optionIds: number[] }) => votePoll(pollId, optionIds),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: pollQueryKey }),
  });
};

export const useCreatePollMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createPoll, onSuccess: async () => queryClient.invalidateQueries({ queryKey: pollQueryKey }) });
};

export const useUpdatePollMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pollId, request }: { pollId: number; request: PollDefinitionRequest }) => updatePoll(pollId, request),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: pollQueryKey }),
  });
};

export const useUpdatePollStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pollId, status }: { pollId: number; status: Exclude<PollStatus, "OPEN"> }) => updatePollStatus(pollId, status),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: pollQueryKey }),
  });
};

export const useDeletePollMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePoll,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: pollQueryKey }),
  });
};
