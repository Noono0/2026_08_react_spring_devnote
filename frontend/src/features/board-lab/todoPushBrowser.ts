const scope = "/react/boards/todo";
export const supportsTodoPush = () => Boolean(window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window);

export async function currentTodoSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(scope);
  return registration ? registration.pushManager.getSubscription() : null;
}

function waitForActivation(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active?.state === "activated") return Promise.resolve();
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) return Promise.reject(new Error("알림 기능을 시작하지 못했습니다. 다시 시도해 주세요."));
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timer); worker.removeEventListener("statechange", changed);
      if (error) reject(error); else resolve();
    };
    const changed = () => {
      if (worker.state === "activated") finish();
      else if (worker.state === "redundant") finish(new Error("알림 기능이 갱신되었습니다. 다시 시도해 주세요."));
    };
    const timer = window.setTimeout(() => finish(new Error("알림 연결 시간이 초과되었습니다. 다시 시도해 주세요.")), 15000);
    worker.addEventListener("statechange", changed); changed();
  });
}

export async function subscribeTodoPush(publicKey: string, replaceExisting = false): Promise<PushSubscription> {
  // 권한 창은 사용자 클릭에서 바로 요청한다. / Request permission directly from the user gesture.
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 허용되지 않았습니다. 브라우저의 사이트 설정에서 알림을 허용해 주세요.");
  const registration = await navigator.serviceWorker.register("/todo-push-sw.js", { scope, updateViaCache: "none" });
  await waitForActivation(registration);
  const binary = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/"));
  const key = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const previous = await registration.pushManager.getSubscription();
  if (previous) {
    const oldKey = previous.options.applicationServerKey;
    if (!replaceExisting && oldKey && btoa(String.fromCharCode(...new Uint8Array(oldKey))).replace(/=+$/, "") === btoa(binary).replace(/=+$/, "")) return previous;
    if (!await previous.unsubscribe()) throw new Error("이전 알림 연결을 해제하지 못했습니다. 다시 시도해 주세요.");
  }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}
