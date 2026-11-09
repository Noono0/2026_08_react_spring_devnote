import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { changeOwnPassword, getOwnAccount, updateOwnAccount } from "@/features/auth/api/authApi";

export const useOwnAccountQuery = () => useQuery({ queryKey: ["account"], queryFn: getOwnAccount, retry: false });

export const useUpdateOwnAccountMutation = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: updateOwnAccount, onSuccess: async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["account"] }),
      client.invalidateQueries({ queryKey: ["auth", "session"] }),
      client.invalidateQueries({ queryKey: ["admin", "members"] }),
    ]);
  } });
};

export const useChangeOwnPasswordMutation = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: changeOwnPassword, onSuccess: async () => client.invalidateQueries({ queryKey: ["account"] }) });
};
