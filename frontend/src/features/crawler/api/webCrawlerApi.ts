import type { ApiResponse } from "@/shared/api/apiResponseTypes";
import { selectedHttpClient } from "@/shared/api/http/selectedHttpClient";
import {
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

export const runWebCrawler = async (request: CrawlerRunRequest): Promise<CrawlerRunResponse> => {
  const response = await selectedHttpClient.post<CrawlerRunRequest, ApiResponse<unknown>>(
    "/utilities/crawler/run",
    request,
    { timeoutMilliseconds: 3_660_000 },
  );
  return crawlerRunResponseSchema.parse(response.data);
};

export const getNaverCrawlerSessionStatus = async (): Promise<CrawlerSessionStatus> => {
  const response = await selectedHttpClient.get<ApiResponse<unknown>>("/utilities/crawler/sessions/naver");
  return crawlerSessionStatusSchema.parse(response.data);
};

export const deleteNaverCrawlerSession = async (): Promise<CrawlerSessionStatus> => {
  const response = await selectedHttpClient.delete<ApiResponse<unknown>>("/utilities/crawler/sessions/naver");
  return crawlerSessionStatusSchema.parse(response.data);
};

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
