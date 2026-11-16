import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authSessionQueryKey, useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import type { AuthSession } from "@/features/auth/types/authTypes";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { todoApi, todoQueryRoot, type TodoGuestMergeInput } from "./todoApi";

/** 실제 로그인 폼이 닫힌 뒤 한 번만 마운트한다. 취소는 어떤 데이터도 바꾸지 않는다. */
export function TodoGuestMergePrompt({ memberId, onClose }: { memberId: number; onClose: () => void }) {
  const client = useQueryClient();
  const session = useAuthSessionQuery();
  const active = session.data?.authenticated && session.data.memberId === memberId;
  const preview = useQuery({ queryKey: [...todoQueryRoot, "guest-merge", memberId], queryFn: ({ signal }) => todoApi.mergePreview(signal),
    enabled: Boolean(active), staleTime: 0, gcTime: 0, retry: false });
  const merge = useMutation({ mutationFn: (input: TodoGuestMergeInput) => todoApi.mergeGuest(input),
    onSuccess: async (result, input) => {
      onClose();
      await client.cancelQueries({ queryKey: [...todoQueryRoot, "items", input.guestKey] });
      client.removeQueries({ queryKey: [...todoQueryRoot, "items", input.guestKey] });
      await client.invalidateQueries({ queryKey: [...todoQueryRoot, "items", `member:${memberId}`] });
      const current = client.getQueryData<AuthSession>(authSessionQueryKey);
      if (current?.authenticated && current.memberId === memberId) applicationNotification.success(result.mergedCount
        ? `할 일 ${result.mergedCount}개를 계정으로 가져왔습니다.` : "이미 가져왔거나 가져올 할 일이 없습니다.");
    },
    onError: (error) => {
      const problem = convertRequestErrorToProblemDetails(error);
      applicationNotification.apiError(problem);
      if (problem.errorCode === "TODO_MERGE_CONTEXT_CHANGED") { onClose(); void client.invalidateQueries({ queryKey: authSessionQueryKey }); }
    },
  });
  useEffect(() => {
    if (!active || (preview.isSuccess && preview.data.count === 0 && !merge.isPending)) onClose();
  }, [active, preview.isSuccess, preview.data?.count, merge.isPending, onClose]);
  if (!active || preview.isPending || (preview.isSuccess && preview.data.count === 0)) return null;
  const confirm = () => {
    if (merge.isPending) return;
    if (preview.isError) { void preview.refetch(); return; }
    if (preview.data?.guestKey) merge.mutate({ guestKey: preview.data.guestKey, expectedMemberId: memberId, throughTodoId: preview.data.throughTodoId });
  };
  return <ConfirmDialog isOpen title={preview.isError ? "비회원 TODO 확인" : "비회원 TODO 가져오기"}
    description={preview.isError ? "비회원 할 일을 확인하지 못했습니다. 다시 확인하거나 나중에 로그인할 때 가져올 수 있습니다."
      : `이 브라우저에서 작성한 할 일 ${preview.data?.count ?? 0}개를 ${session.data?.memberName || "현재 로그인한"} 계정으로 가져올까요? 제목·메모·완료 상태는 유지되며, 가져온 항목은 비회원 목록에서 사라집니다.`}
    confirmButtonLabel={preview.isError ? "다시 확인" : "예, 가져오기"} cancelButtonLabel="아니요, 유지"
    isConfirming={merge.isPending || preview.isFetching} onConfirm={confirm} onCancel={() => { if (!merge.isPending) onClose(); }} />;
}
