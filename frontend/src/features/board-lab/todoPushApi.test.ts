import { beforeEach, expect, it, vi } from "vitest";
import { todoPushApi } from "./todoPushApi";
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/api/http/selectedHttpClient", () => ({ selectedHttpClient: client }));
beforeEach(() => { vi.clearAllMocks(); });
it("공개 키와 기기 연결 상태를 검증하며 비밀 키는 요구하지 않는다", async () => {
  const settings = { configured: true, publicKey: "B" + "A".repeat(86), subscribed: true };
  client.get.mockResolvedValue({ data: settings }); expect(await todoPushApi.settings()).toEqual(settings);
  client.get.mockResolvedValue({ data: { ...settings, publicKey: "invalid" } }); await expect(todoPushApi.settings()).rejects.toThrow();
});
it("소유자 확인값과 구독 주소만 등록하고 해제에도 확인값을 보낸다", async () => {
  const input = { expectedOwnerKey: "member:2", endpoint: "https://fcm.googleapis.com/wp/private" };
  await todoPushApi.subscribe(input); await todoPushApi.unsubscribe("member:2");
  expect(client.post).toHaveBeenCalledWith("/board-todos/push/subscription", input);
  expect(client.delete).toHaveBeenCalledWith("/board-todos/push/subscription", { queryParameters: { expectedOwnerKey: "member:2" } });
});
