/**
 * webCrawlerApi.ts — 웹 크롤러 API 호출 모음 (서버 CrawlerController와 1:1)
 *
 * ★ 응답을 ApiResponse<unknown>으로 받은 뒤 Zod 스키마(.parse)로 검사한다.
 *   크롤러 응답은 모양이 복잡하고 자주 바뀌어, 서버와 화면이 어긋나면 화면 깊은 곳에서 터지기 전에
 *   여기서 "어느 필드가 틀렸는지" 바로 알 수 있게 하기 위해서다.
 */

import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import {
  crawlerBrowserStatusSchema,
  type CrawlerBrowserStatus,
  crawlerRunResponseSchema,
  crawlerLiveViewSchema,
  crawlerConfigurationSchema,
  crawlerRunHistoryDetailSchema,
  crawlerRunHistorySummarySchema,
  crawlerTrackedRunResponseSchema,
  type CrawlerConfiguration,
  type CrawlerConfigurationSaveRequest,
  type CrawlerRunHistoryDetail,
  type CrawlerRunHistorySummary,
  type CrawlerTrackedRunResponse,
  crawlerSessionStatusSchema,
  type CrawlerRunRequest,
  type CrawlerRunResponse,
  type CrawlerLiveView,
  type CrawlerManualActionRequest,
  type CrawlerSessionStatus,
} from "@/features/crawler/types/webCrawlerTypes";

// ── 브라우저 실행 준비 상태: 실행 위치(LOCAL/REMOTE)와 원격 브라우저 연결 여부 ──
export const getCrawlerBrowserStatus = async (): Promise<CrawlerBrowserStatus> => {
  const response = await selectedHttpClient.get<ApiResponse<unknown>>("/utilities/crawler/browser-status");
  return crawlerBrowserStatusSchema.parse(response.data);
};

// ── 실시간 화면: 상태 읽기 / 수동 조작 보내기 / 실패 후 열어 둔 브라우저 닫기 ──
export const getCrawlerLiveView = async (): Promise<CrawlerLiveView> => {
  const response = await selectedHttpClient.get<ApiResponse<unknown>>("/utilities/crawler/live-view");
  return crawlerLiveViewSchema.parse(response.data);
};

export const sendCrawlerManualAction = async (request: CrawlerManualActionRequest): Promise<CrawlerLiveView> => {
  const response = await selectedHttpClient.post<CrawlerManualActionRequest, ApiResponse<unknown>>(
    "/utilities/crawler/live-view/actions", request,
  );
  return crawlerLiveViewSchema.parse(response.data);
};

export const closeCrawlerLiveView = async (): Promise<CrawlerLiveView> => {
  const response = await selectedHttpClient.post<Record<string, never>, ApiResponse<unknown>>(
    "/utilities/crawler/live-view/close", {},
  );
  return crawlerLiveViewSchema.parse(response.data);
};

// ── 녹화: 브라우저에서 한 클릭·입력을 단계로 기록 ──
export const startCrawlerRecording = async (
  request: { startUrl: string; browserWindow: "WEB" | "PC_WINDOW" },
): Promise<CrawlerLiveView> => {
  const response = await selectedHttpClient.post<typeof request, ApiResponse<unknown>>(
    "/utilities/crawler/recording/start", request,
  );
  return crawlerLiveViewSchema.parse(response.data);
};

export const stopCrawlerRecording = async (): Promise<CrawlerLiveView> => {
  const response = await selectedHttpClient.post<Record<string, never>, ApiResponse<unknown>>(
    "/utilities/crawler/recording/stop", {},
  );
  return crawlerLiveViewSchema.parse(response.data);
};

// ── 바로 실행(이력 없음). 단계 실행은 최대 60분까지 걸릴 수 있어 요청 제한 시간을 61분으로 늘린다. ──
export const runWebCrawler = async (request: CrawlerRunRequest): Promise<CrawlerRunResponse> => {
  const response = await selectedHttpClient.post<CrawlerRunRequest, ApiResponse<unknown>>(
    "/utilities/crawler/run",
    request,
    { timeoutMilliseconds: 3_660_000 },
  );
  return crawlerRunResponseSchema.parse(response.data);
};

// ── 저장된 네이버 로그인 세션: 있는지 확인 / 삭제 ──
export const getNaverCrawlerSessionStatus = async (): Promise<CrawlerSessionStatus> => {
  const response = await selectedHttpClient.get<ApiResponse<unknown>>("/utilities/crawler/sessions/naver");
  return crawlerSessionStatusSchema.parse(response.data);
};

export const deleteNaverCrawlerSession = async (): Promise<CrawlerSessionStatus> => {
  const response = await selectedHttpClient.delete<ApiResponse<unknown>>("/utilities/crawler/sessions/naver");
  return crawlerSessionStatusSchema.parse(response.data);
};

// ── 저장된 설정 CRUD와 "설정으로 실행(이력 남김)", 실행 이력 조회·삭제 ──
export const getCrawlerConfigurations = async (): Promise<CrawlerConfiguration[]> => {
  const response = await selectedHttpClient.get<ApiResponse<unknown>>("/utilities/crawler/configurations");
  return crawlerConfigurationSchema.array().parse(response.data);
};

export const createCrawlerConfiguration = async (request: CrawlerConfigurationSaveRequest): Promise<CrawlerConfiguration> => {
  const response = await selectedHttpClient.post<CrawlerConfigurationSaveRequest, ApiResponse<unknown>>("/utilities/crawler/configurations", request);
  return crawlerConfigurationSchema.parse(response.data);
};

export const updateCrawlerConfiguration = async (configurationId: number, request: CrawlerConfigurationSaveRequest): Promise<CrawlerConfiguration> => {
  const response = await selectedHttpClient.put<CrawlerConfigurationSaveRequest, ApiResponse<unknown>>(`/utilities/crawler/configurations/${configurationId}`, request);
  return crawlerConfigurationSchema.parse(response.data);
};

export const deleteCrawlerConfiguration = async (configurationId: number): Promise<void> => {
  await selectedHttpClient.delete<ApiResponse<void>>(`/utilities/crawler/configurations/${configurationId}`);
};

export const runCrawlerConfiguration = async (configurationId: number, request: CrawlerRunRequest): Promise<CrawlerTrackedRunResponse> => {
  const response = await selectedHttpClient.post<CrawlerRunRequest, ApiResponse<unknown>>(
    `/utilities/crawler/configurations/${configurationId}/runs`, request, { timeoutMilliseconds: 3_660_000 },
  );
  return crawlerTrackedRunResponseSchema.parse(response.data);
};

export const getCrawlerRunHistories = async (configurationId: number): Promise<CrawlerRunHistorySummary[]> => {
  const response = await selectedHttpClient.get<ApiResponse<unknown>>(`/utilities/crawler/configurations/${configurationId}/histories`);
  return crawlerRunHistorySummarySchema.array().parse(response.data);
};

export const getCrawlerRunHistory = async (historyId: number): Promise<CrawlerRunHistoryDetail> => {
  const response = await selectedHttpClient.get<ApiResponse<unknown>>(`/utilities/crawler/histories/${historyId}`);
  return crawlerRunHistoryDetailSchema.parse(response.data);
};

export const deleteCrawlerRunHistory = async (historyId: number): Promise<void> => {
  await selectedHttpClient.delete<ApiResponse<void>>(`/utilities/crawler/histories/${historyId}`);
};
