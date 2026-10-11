// onlineApi.ts — 온라인 대전 대기실 API(서버 OnlineRoomController와 1:1). 응답 ApiResponse에서 data만 꺼내 돌려준다.
// 방 안의 실시간 통신은 REST가 아니라 WebSocket(useOnlineRoom)으로 한다.

import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import { applicationEnvironment } from "@/shared/config/applicationEnvironment";
import type { OnlineGameTypeInfo, OnlineRoomCreated, OnlineRoomCreateRequest, OnlineRoomSummary } from "@/features/games/online/onlineTypes";

export const onlineQueryKeys = {
  gameTypes: ["online", "game-types"] as const,
  rooms: ["online", "rooms"] as const,
};

export const getOnlineGameTypes = async (): Promise<OnlineGameTypeInfo[]> =>
  (await selectedHttpClient.get<ApiResponse<OnlineGameTypeInfo[]>>("/online/game-types")).data;

export const getOnlineRooms = async (): Promise<OnlineRoomSummary[]> =>
  (await selectedHttpClient.get<ApiResponse<OnlineRoomSummary[]>>("/online/rooms")).data;

export const createOnlineRoom = async (request: OnlineRoomCreateRequest): Promise<OnlineRoomCreated> =>
  (await selectedHttpClient.post<OnlineRoomCreateRequest, ApiResponse<OnlineRoomCreated>>("/online/rooms", request)).data;

/**
 * WebSocket 주소 만들기. REST와 같은 API 주소(VITE_API_BASE_URL) 뒤에 /online/ws를 붙이고 http → ws로 바꾼다.
 *   "/api/v1"(상대 주소)      → ws://지금주소/api/v1/online/ws  (https 페이지면 wss://)
 *   "http://host:8080/api/v1" → ws://host:8080/api/v1/online/ws
 * URL 생성자는 상대 주소를 지금 페이지 주소(location) 기준으로 풀어 준다.
 */
export const buildOnlineSocketUrl = (apiBaseUrl: string = applicationEnvironment.VITE_API_BASE_URL, pageUrl: string = window.location.href): string => {
  const url = new URL(`${apiBaseUrl.replace(/\/$/, "")}/online/ws`, pageUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};
