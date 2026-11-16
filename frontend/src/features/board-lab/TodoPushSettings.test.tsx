import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { TodoPushSettings } from "./TodoPushSettings";

const mocks = vi.hoisted(() => ({ supported: vi.fn(), settings: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), current: vi.fn(), browserSubscribe: vi.fn(), browserUnsubscribe: vi.fn() }));
vi.mock("./todoPushApi", () => ({ todoPushApi: { settings: mocks.settings, subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe } }));
vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: {} }));
vi.mock("./todoPushBrowser", () => ({ supportsTodoPush: mocks.supported, currentTodoSubscription: mocks.current, subscribeTodoPush: mocks.browserSubscribe }));
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><TodoPushSettings owner={{ mode: "MEMBER", cacheKey: "member:2" }} /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("Notification", { permission: "granted" });
  mocks.supported.mockReturnValue(true); mocks.settings.mockResolvedValue({ configured: true, publicKey: "public", subscribed: false });
  mocks.current.mockResolvedValue(null); mocks.browserSubscribe.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/test" });
  mocks.subscribe.mockResolvedValue(undefined); mocks.unsubscribe.mockResolvedValue(undefined); mocks.browserUnsubscribe.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllGlobals());
it("비지원 환경에서는 권한을 요구하지 않고 아이폰 홈 화면 안내를 표시한다", () => {
  mocks.supported.mockReturnValue(false); setup();
  expect(screen.getByText(/Safari에서 공유/)).toBeVisible(); expect(mocks.settings).not.toHaveBeenCalled();
});
it("서버 미설정 상태에서 저장 가능 안내를 표시하고 연결 버튼을 숨긴다", async () => {
  mocks.settings.mockResolvedValue({ configured: false, publicKey: "", subscribed: false }); setup();
  expect(await screen.findByText(/서버의 웹 푸시 설정이 아직/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "이 기기 알림 켜기" })).not.toBeInTheDocument();
});
it("클릭할 때만 구독하고 현재 소유자 키와 주소만 서버에 등록한다", async () => {
  setup(); const button = await screen.findByRole("button", { name: "이 기기 알림 켜기" });
  expect(mocks.browserSubscribe).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(mocks.browserSubscribe).toHaveBeenCalledWith("public", true));
  await waitFor(() => expect(mocks.subscribe).toHaveBeenCalledWith({ expectedOwnerKey: "member:2", endpoint: "https://fcm.googleapis.com/test" }));
});
it("서버에서 먼저 끄고 브라우저 구독을 해제한다", async () => {
  mocks.settings.mockResolvedValue({ configured: true, publicKey: "public", subscribed: true });
  mocks.current.mockResolvedValue({ unsubscribe: mocks.browserUnsubscribe }); setup();
  fireEvent.click(await screen.findByRole("button", { name: "이 기기 알림 끄기" }));
  await waitFor(() => expect(mocks.browserUnsubscribe).toHaveBeenCalled());
  expect(mocks.unsubscribe).toHaveBeenCalledWith("member:2");
  expect(mocks.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(mocks.browserUnsubscribe.mock.invocationCallOrder[0] ?? 0);
});
it("권한 차단과 서버 등록 실패를 구분해 안내한다", async () => {
  vi.stubGlobal("Notification", { permission: "denied" }); const view = setup();
  expect(await screen.findByRole("button", { name: "이 기기 알림 켜기" })).toBeDisabled();
  view.unmount(); vi.stubGlobal("Notification", { permission: "granted" }); mocks.subscribe.mockRejectedValue(new Error("등록 실패")); setup();
  fireEvent.click(await screen.findByRole("button", { name: "이 기기 알림 켜기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("등록 실패");
});
