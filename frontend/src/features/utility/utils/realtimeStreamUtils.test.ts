import { filterRealtimeLogs, formatRealtimePayload, validateRealtimeUrl } from "@/features/utility/utils/realtimeStreamUtils";

describe("realtimeStreamUtils", () => {
  it("프로토콜에 맞는 연결 주소만 허용한다", () => {
    expect(validateRealtimeUrl("WEBSOCKET", "wss://example.com/socket").protocol).toBe("wss:");
    expect(validateRealtimeUrl("SSE", "https://example.com/events").protocol).toBe("https:");
    expect(() => validateRealtimeUrl("WEBSOCKET", "https://example.com")).toThrow("ws://");
  });

  it("JSON 메시지를 보기 좋게 정리하고 로그를 필터링한다", () => {
    expect(formatRealtimePayload('{"ok":true}')).toContain('\n  "ok"');
    const logs = [{ id: "1", timestamp: "now", direction: "RECEIVED" as const, eventName: "message", data: "hello" }];
    expect(filterRealtimeLogs(logs, "hello", "RECEIVED")).toHaveLength(1);
    expect(filterRealtimeLogs(logs, "missing", "ALL")).toHaveLength(0);
  });
});
