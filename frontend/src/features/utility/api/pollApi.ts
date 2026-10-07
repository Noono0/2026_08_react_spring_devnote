// pollApi.ts — 토픽 투표 API(서버 PollController와 1:1). 응답 ApiResponse에서 data만 꺼내 돌려준다.

import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { Poll, PollDefinitionRequest, PollPageResponse, PollSearchCondition, PollStatus } from "@/features/utility/types/pollTypes";

// 목록: 검색 조건 객체를 쿼리 문자열(?pageNumber=0&status=OPEN …)로 바꿔 보낸다.
export const getPolls = async (condition: PollSearchCondition): Promise<PollPageResponse> =>
  (await selectedHttpClient.get<ApiResponse<PollPageResponse>>("/polls", { queryParameters: condition })).data;

export const votePoll = async (pollId: number, optionIds: number[]): Promise<Poll> =>
  (await selectedHttpClient.post<{ optionIds: number[] }, ApiResponse<Poll>>(`/polls/${pollId}/votes`, { optionIds })).data;

export const createPoll = async (request: PollDefinitionRequest): Promise<Poll> =>
  (await selectedHttpClient.post<typeof request, ApiResponse<Poll>>("/polls", request)).data;

export const updatePoll = async (pollId: number, request: PollDefinitionRequest): Promise<Poll> =>
  (await selectedHttpClient.put<typeof request, ApiResponse<Poll>>(`/polls/${pollId}`, request)).data;

// 상태 변경: Exclude<PollStatus, "OPEN"> = 마감·결과 공개만 보낼 수 있다(다시 OPEN으로는 못 돌린다 — 서버 규칙과 같음).
export const updatePollStatus = async (pollId: number, status: Exclude<PollStatus, "OPEN">): Promise<Poll> =>
  (await selectedHttpClient.put<{ status: Exclude<PollStatus, "OPEN"> }, ApiResponse<Poll>>(`/polls/${pollId}/status`, { status })).data;

export const deletePoll = async (pollId: number): Promise<void> => {
  await selectedHttpClient.delete<ApiResponse<void>>(`/polls/${pollId}`);
};
