import { useMutation, useQuery } from "@tanstack/react-query";
import { convertRequestErrorToProblemDetails } from "@/shared/api/error/apiErrorHelpers";
import { todoQueryRoot, type TodoOwnerView } from "./todoApi";
import { todoPushApi } from "./todoPushApi";
import { currentTodoSubscription, subscribeTodoPush, supportsTodoPush } from "./todoPushBrowser";

export function TodoPushSettings({ owner }: { owner: TodoOwnerView }) {
  const supported = supportsTodoPush();
  const settings = useQuery({ queryKey: [...todoQueryRoot, "push", owner.cacheKey], enabled: supported, retry: false, gcTime: 0,
    queryFn: async ({ signal }) => ({ server: await todoPushApi.settings(signal), browser: await currentTodoSubscription() }) });
  const change = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        if (!settings.data?.server.configured) throw new Error("서버의 웹 푸시 설정이 아직 준비되지 않았습니다.");
        // 쿠키 삭제·계정 전환 뒤 서버 연결이 없으면 이전 주소 대신 새 구독을 만든다.
        // Replace orphaned browser subscriptions after cookie loss or an ownership transition.
        const subscription = await subscribeTodoPush(settings.data.server.publicKey, !settings.data.server.subscribed);
        await todoPushApi.subscribe({ expectedOwnerKey: owner.cacheKey, endpoint: subscription.endpoint });
      } else {
        await todoPushApi.unsubscribe(owner.cacheKey);
        const subscription = await currentTodoSubscription();
        if (subscription && !await subscription.unsubscribe()) throw new Error("서버 발송은 껐지만 브라우저 연결 해제가 지연되고 있습니다. 다시 확인해 주세요.");
      }
    },
    onSuccess: async () => { await settings.refetch(); },
  });
  const subscribed = Boolean(settings.data?.server.subscribed && settings.data.browser && Notification.permission === "granted");
  const problem = change.isError ? convertRequestErrorToProblemDetails(change.error) : null;
  const failureMessage = problem?.errorCode === "UNKNOWN_CLIENT_ERROR" && change.error instanceof Error ? change.error.message : problem?.detail;
  return <section className="todo-push-settings" aria-label="웹 푸시 알림 설정">
    <h3>이 기기의 웹 푸시 알림</h3>
    {!supported ? <p className="board-lab-hint">웹 푸시는 HTTPS와 지원 브라우저가 필요합니다. 아이폰(iOS 16.4 이상)은 Safari에서 공유 → 홈 화면에 추가한 앱을 열고 알림을 켜 주세요. 알림 시간은 지금도 저장할 수 있습니다.</p>
      : <>
        {settings.isPending ? <p role="status">알림 연결을 확인하는 중입니다.</p> : null}
        {settings.isError ? <p role="alert">알림 연결을 확인하지 못했습니다. <button type="button" onClick={() => void settings.refetch()}>알림 연결 다시 확인</button></p> : null}
        {settings.data && !settings.isError ? <>
          {!settings.data.server.configured ? <p>서버의 웹 푸시 설정이 아직 준비되지 않았습니다. 알림 시간은 저장할 수 있습니다.</p> : <>
            <p>{subscribed ? "켜짐 · 이 브라우저에서 예약한 TODO 알림을 받습니다." : "꺼짐 · 이 브라우저에서 알림을 켜 주세요."}</p>
            {Notification.permission === "denied" ? <p>알림이 차단되어 있습니다. 브라우저의 사이트 설정에서 알림을 허용한 후 다시 확인해 주세요.</p> : null}
            <div className="board-lab-actions"><button type="button" disabled={change.isPending || (!subscribed && Notification.permission === "denied")}
              onClick={() => change.mutate(!subscribed)}>{change.isPending ? "알림 연결 처리 중..." : subscribed ? "이 기기 알림 끄기" : "이 기기 알림 켜기"}</button>
              <button type="button" disabled={change.isPending || settings.isFetching} onClick={() => void settings.refetch()}>연결 확인</button></div>
            {!subscribed && settings.data.server.subscribed ? <button type="button" disabled={change.isPending} onClick={() => change.mutate(false)}>서버의 이 기기 알림 연결 해제</button> : null}
          </>}
        </> : null}
        {change.isError ? <p role="alert">{failureMessage || "알림 설정을 변경하지 못했습니다. 다시 시도해 주세요."}</p> : null}
      </>}
    <p className="board-lab-hint">{owner.mode === "MEMBER" ? "PC·휴대폰에서 같은 계정으로 로그인한 후 기기마다 한 번 켜 주세요." : "비회원 알림은 이 브라우저에만 연결됩니다."} 로그인·로그아웃하면 이 기기의 연결이 해제됩니다.</p>
    <p className="board-lab-hint">탭을 닫아도 받을 수 있습니다. 전원·네트워크·배터리 절약·방해 금지 설정에 따라 지연될 수 있으며, 잠금 화면에는 TODO 제목·메모를 표시하지 않습니다.</p>
  </section>;
}
