import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { isApiErrorRetryable } from "@/shared/api/error/apiErrorHelpers";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, requestError) =>
        failureCount < 2 && isApiErrorRetryable(requestError),
    },
    mutations: {
      retry: false,
    },
  },
});

export const ApplicationProviders = ({ children }: PropsWithChildren) => {
  const applicationTheme = useApplicationUiStore((state) => state.applicationTheme);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster theme={applicationTheme} position="bottom-right" richColors closeButton visibleToasts={5} />
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
};
