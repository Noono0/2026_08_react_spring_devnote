/**
 * useWebCrawler.ts — 크롤러 화면의 서버 상태 훅 모음(TanStack Query)
 *
 *   실행·녹화·수동 조작 → useMutation(서버에 무언가를 시킨다)
 *   실시간 화면·설정·이력·세션 상태 → useQuery(서버 상태를 읽는다)
 * 수동 조작·녹화의 응답은 최신 실시간 화면 상태이므로, 다시 요청하지 않고 setQueriesData로 캐시에 바로 넣는다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteNaverCrawlerSession,
  createCrawlerConfiguration,
  deleteCrawlerConfiguration,
  deleteCrawlerRunHistory,
  getCrawlerConfigurations,
  closeCrawlerLiveView,
  getCrawlerBrowserStatus,
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

/** 원격 브라우저를 기다리는 동안 다시 확인하는 간격(5초). 사용자가 PC에서 Chrome을 켜면 곧 버튼이 풀린다. */
const BROWSER_STATUS_RETRY_INTERVAL = 5_000;

/**
 * 브라우저 실행 준비 상태. 준비되지 않았을 때만 5초마다 다시 묻고, 준비되면 멈춘다(불필요한 요청 방지).
 * 창으로 돌아왔을 때(refetchOnWindowFocus, 기본값)도 다시 확인한다.
 */
export const useCrawlerBrowserStatus = () => useQuery({
  queryKey: ["crawler", "browser-status"],
  queryFn: getCrawlerBrowserStatus,
  retry: false,
  refetchInterval: (query) => (query.state.data?.ready === false ? BROWSER_STATUS_RETRY_INTERVAL : false),
});

/**
 * 실시간 화면 상태. polling이 true면 0.7초마다 다시 받아 화면 캡처와 진행 단계를 갱신한다.
 * retry: false — 실패하면 다시 시도하지 않고 다음 주기를 기다린다(0.7초마다 재시도가 쌓이지 않게).
 */
export const useCrawlerLiveView = (enabled: boolean, polling = enabled) => useQuery({
  queryKey: ["crawler", "live-view", polling],
  queryFn: getCrawlerLiveView,
  enabled,
  retry: false,
  // 실행 중이거나, 실패 후 브라우저를 열어 둔 동안(inspecting)에는 화면을 계속 갱신한다.
  refetchInterval: (query) => (polling || query.state.data?.inspecting === true || query.state.data?.recording === true ? 700 : false),
});

// setQueriesData: ["crawler", "live-view"]로 시작하는 모든 캐시(polling 값이 다른 것까지)에 응답을 넣는다.
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

/** 설정 생성·수정·삭제가 공통으로 쓰는 틀: 성공하면 설정 목록을 다시 받는다. 제네릭으로 인자·결과 타입을 그대로 이어받는다. */
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
    // onSettled: 성공이든 실패든 끝나면 실행 횟수·마지막 상태(설정 목록)와 이력 목록을 새로 받는다(실패도 이력에 남기 때문).
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
  // enabled가 false면 이 함수는 불리지 않으므로, 불릴 때는 configurationId가 반드시 있다.
  queryFn: () => getCrawlerRunHistories(configurationId as number),
  enabled: configurationId !== undefined,
});

// 이력 상세는 사용자가 "열기"를 누를 때만 받으므로 useMutation으로 필요할 때 한 번 호출한다.
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
