import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import type { Poll, PollDefinitionRequest, PollPageResponse, PollSearchCondition, PollStatus } from "@/features/utility/types/pollTypes";

export const getPolls = async (condition: PollSearchCondition): Promise<PollPageResponse> =>
  (await selectedHttpClient.get<ApiResponse<PollPageResponse>>("/polls", { queryParameters: condition })).data;

export const votePoll = async (pollId: number, optionIds: number[]): Promise<Poll> =>
  (await selectedHttpClient.post<{ optionIds: number[] }, ApiResponse<Poll>>(`/polls/${pollId}/votes`, { optionIds })).data;

export const createPoll = async (request: PollDefinitionRequest): Promise<Poll> =>
  (await selectedHttpClient.post<typeof request, ApiResponse<Poll>>("/polls", request)).data;

export const updatePoll = async (pollId: number, request: PollDefinitionRequest): Promise<Poll> =>
  (await selectedHttpClient.put<typeof request, ApiResponse<Poll>>(`/polls/${pollId}`, request)).data;

export const updatePollStatus = async (pollId: number, status: Exclude<PollStatus, "OPEN">): Promise<Poll> =>
  (await selectedHttpClient.put<{ status: Exclude<PollStatus, "OPEN"> }, ApiResponse<Poll>>(`/polls/${pollId}/status`, { status })).data;

export const deletePoll = async (pollId: number): Promise<void> => {
  await selectedHttpClient.delete<ApiResponse<void>>(`/polls/${pollId}`);
};
