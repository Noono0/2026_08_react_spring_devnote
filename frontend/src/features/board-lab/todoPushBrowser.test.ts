import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { currentTodoSubscription, subscribeTodoPush, supportsTodoPush } from "./todoPushBrowser";

const permission = vi.fn(); const subscribe = vi.fn(); const getSubscription = vi.fn(); const register = vi.fn(); const getRegistration = vi.fn();
const publicBytes = Uint8Array.from({ length: 65 }, (_, index) => index === 0 ? 4 : index);
const publicKey = btoa(String.fromCharCode(...publicBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("isSecureContext", true); vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission: "default", requestPermission: permission }); permission.mockResolvedValue("granted");
  vi.stubGlobal("navigator", { serviceWorker: { register, getRegistration } });
  register.mockResolvedValue({ active: { state: "activated" }, pushManager: { getSubscription, subscribe } });
  getSubscription.mockResolvedValue(null); subscribe.mockResolvedValue({ endpoint: "subscribed" }); getRegistration.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("HTTPS와 API 지원을 함께 확인한다", () => {
  expect(supportsTodoPush()).toBe(true); vi.stubGlobal("isSecureContext", false); expect(supportsTodoPush()).toBe(false);
});
it("기존 TODO 범위의 구독만 조회한다", async () => {
  expect(await currentTodoSubscription()).toBeNull(); expect(getRegistration).toHaveBeenCalledWith("/react/boards/todo");
});
it("권한을 먼저 요청하고 전용 워커와 VAPID 키로 구독한다", async () => {
  await subscribeTodoPush(publicKey);
  expect(permission.mock.invocationCallOrder[0]).toBeLessThan(register.mock.invocationCallOrder[0] ?? 0);
  expect(register).toHaveBeenCalledWith("/todo-push-sw.js", { scope: "/react/boards/todo", updateViaCache: "none" });
  expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: publicBytes });
});
it("거부하면 워커·구독 등록을 시작하지 않는다", async () => {
  permission.mockResolvedValue("denied"); await expect(subscribeTodoPush(publicKey)).rejects.toThrow("권한"); expect(register).not.toHaveBeenCalled();
});
it("같은 공개 키의 기존 구독을 재사용하고 키 교체 시 재구독한다", async () => {
  vi.stubGlobal("Notification", { permission: "granted", requestPermission: permission });
  const unsubscribe = vi.fn().mockResolvedValue(true); const old = { options: { applicationServerKey: publicBytes.buffer }, unsubscribe };
  getSubscription.mockResolvedValue(old); expect(await subscribeTodoPush(publicKey)).toBe(old); expect(permission).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled();
  getSubscription.mockResolvedValue({ ...old, options: { applicationServerKey: new ArrayBuffer(65) } });
  await subscribeTodoPush(publicKey); expect(unsubscribe).toHaveBeenCalledTimes(1); expect(subscribe).toHaveBeenCalledTimes(1);
});
it("활성화 지연은 제한 시간 후 오류로 알리고 이벤트 리스너를 정리한다", async () => {
  vi.useFakeTimers(); const worker = { state: "installing", addEventListener: vi.fn(), removeEventListener: vi.fn() };
  register.mockResolvedValue({ installing: worker });
  const waiting = subscribeTodoPush(publicKey); const assertion = expect(waiting).rejects.toThrow("시간이 초과");
  await vi.advanceTimersByTimeAsync(15001); await assertion; expect(worker.removeEventListener).toHaveBeenCalledWith("statechange", expect.any(Function));
});
