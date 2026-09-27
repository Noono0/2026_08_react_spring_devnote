import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteNaverCrawlerSession,
  createCrawlerConfiguration,
  deleteCrawlerConfiguration,
  deleteCrawlerRunHistory,
  getCrawlerConfigurations,
  closeCrawlerLiveView,
  startCrawlerRecording,
  stopCrawlerRecording,
  getCrawlerLiveView,
  getCrawlerRunHistories,
  getCrawlerRunHistory,
  getNaverCrawlerSessionStatus,
  runCrawlerConfiguration,
  runWebCrawler,
  sendCrawlerManualAction,
  updateCrawlerConfiguration,
} from "@/features/crawler/api/webCrawlerApi";
import type { CrawlerConfigurationSaveRequest, CrawlerRunRequest } from "@/features/crawler/types/webCrawlerTypes";

export const useWebCrawlerMutation = () => useMutation({ mutationFn: runWebCrawler });

export const useCrawlerLiveView = (enabled: boolean, polling = enabled) => useQuery({
  queryKey: ["crawler", "live-view", polling],
  queryFn: getCrawlerLiveView,
  enabled,
  retry: false,
  // 실행 중이거나, 실패 후 브라우저를 열어 둔 동안(inspecting)에는 화면을 계속 갱신한다.
  refetchInterval: (query) => (polling || query.state.data?.inspecting === true || query.state.data?.recording === true ? 700 : false),
});

export const useCrawlerManualAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendCrawlerManualAction,
    onSuccess: (liveView) => {
      queryClient.setQueriesData({ queryKey: ["crawler", "live-view"] }, liveView);
    },
  });
};

export const useCrawlerRecording = () => {
  const queryClient = useQueryClient();
  const onSuccess = (liveView: Awaited<ReturnType<typeof stopCrawlerRecording>>): void => {
    queryClient.setQueriesData({ queryKey: ["crawler", "live-view"] }, liveView);
  };
  return {
    start: useMutation({ mutationFn: startCrawlerRecording, onSuccess }),
    stop: useMutation({ mutationFn: stopCrawlerRecording, onSuccess }),
  };
};

export const useCloseCrawlerLiveView = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: closeCrawlerLiveView,
    onSuccess: (liveView) => {
      queryClient.setQueriesData({ queryKey: ["crawler", "live-view"] }, liveView);
    },
  });
};

const naverSessionQueryKey = ["crawler", "naver-session"] as const;

export const useNaverCrawlerSessionStatus = (enabled: boolean) => useQuery({
  queryKey: naverSessionQueryKey,
  queryFn: getNaverCrawlerSessionStatus,
  enabled,
  retry: false,
});

export const useDeleteNaverCrawlerSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNaverCrawlerSession,
    onSuccess: (status) => queryClient.setQueryData(naverSessionQueryKey, status),
  });
};

const crawlerConfigurationQueryKey = ["crawler", "configurations"] as const;
const crawlerHistoryQueryKey = (configurationId: number) => ["crawler", "configurations", configurationId, "histories"] as const;

export const useCrawlerConfigurations = () => useQuery({
  queryKey: crawlerConfigurationQueryKey,
  queryFn: getCrawlerConfigurations,
});

const useConfigurationMutation = <TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: crawlerConfigurationQueryKey }),
  });
};

export const useCreateCrawlerConfiguration = () => useConfigurationMutation(createCrawlerConfiguration);
export const useUpdateCrawlerConfiguration = () => useConfigurationMutation(
  ({ configurationId, request }: { configurationId: number; request: CrawlerConfigurationSaveRequest }) => updateCrawlerConfiguration(configurationId, request),
);
export const useDeleteCrawlerConfiguration = () => useConfigurationMutation(deleteCrawlerConfiguration);

export const useRunCrawlerConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ configurationId, request }: { configurationId: number; request: CrawlerRunRequest }) => runCrawlerConfiguration(configurationId, request),
    onSettled: async (_data, _error, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: crawlerConfigurationQueryKey }),
        queryClient.invalidateQueries({ queryKey: crawlerHistoryQueryKey(variables.configurationId) }),
      ]);
    },
  });
};

export const useCrawlerRunHistories = (configurationId?: number) => useQuery({
  queryKey: crawlerHistoryQueryKey(configurationId ?? 0),
  queryFn: () => getCrawlerRunHistories(configurationId as number),
  enabled: configurationId !== undefined,
});

export const useCrawlerRunHistoryMutation = () => useMutation({ mutationFn: getCrawlerRunHistory });

export const useDeleteCrawlerRunHistory = (configurationId?: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCrawlerRunHistory,
    onSuccess: async () => {
      if (configurationId !== undefined) await queryClient.invalidateQueries({ queryKey: crawlerHistoryQueryKey(configurationId) });
      await queryClient.invalidateQueries({ queryKey: crawlerConfigurationQueryKey });
    },
  });
};
