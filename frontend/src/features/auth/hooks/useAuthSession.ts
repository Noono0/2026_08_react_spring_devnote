import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthSession, login, logout, register } from "@/features/auth/api/authApi";

export const authSessionQueryKey = ["auth", "session"] as const;
const resetAuthenticatedQueries = async (queryClient: ReturnType<typeof useQueryClient>): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["portfolio", "sections"] }),
    queryClient.invalidateQueries({ queryKey: ["admin"] }),
    queryClient.invalidateQueries({ queryKey: ["documents"] }),
  ]);
};

export const useAuthSessionQuery = () => useQuery({ queryKey: authSessionQueryKey, queryFn: getAuthSession, retry: false });
export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: login, onSuccess: async (session) => { queryClient.setQueryData(authSessionQueryKey, session); await resetAuthenticatedQueries(queryClient); } });
};
export const useRegisterMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: register, onSuccess: async (session) => { queryClient.setQueryData(authSessionQueryKey, session); await resetAuthenticatedQueries(queryClient); } });
};
export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: logout, onSuccess: async (session) => { queryClient.setQueryData(authSessionQueryKey, session); await resetAuthenticatedQueries(queryClient); } });
};
