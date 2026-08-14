export type RealtimeProtocol = "WEBSOCKET" | "SSE";
export type RealtimeLogDirection = "SYSTEM" | "SENT" | "RECEIVED" | "ERROR";

export interface RealtimeLogEntry {
  id: string;
  timestamp: string;
  direction: RealtimeLogDirection;
  eventName: string;
  data: string;
}

export const validateRealtimeUrl = (protocol: RealtimeProtocol, value: string): URL => {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("올바른 연결 URL을 입력해 주세요."); }
  if (protocol === "WEBSOCKET" && !["ws:", "wss:"].includes(url.protocol)) throw new Error("WebSocket 주소는 ws:// 또는 wss://로 시작해야 합니다.");
  if (protocol === "SSE" && !["http:", "https:"].includes(url.protocol)) throw new Error("SSE 주소는 http:// 또는 https://로 시작해야 합니다.");
  return url;
};

export const formatRealtimePayload = (value: unknown): string => {
  const text = typeof value === "string" ? value : value instanceof Blob ? `[Blob ${value.size.toLocaleString("ko-KR")} bytes]` : value instanceof ArrayBuffer ? `[ArrayBuffer ${value.byteLength.toLocaleString("ko-KR")} bytes]` : String(value);
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
};

export const filterRealtimeLogs = (logs: RealtimeLogEntry[], query: string, direction: "ALL" | RealtimeLogDirection): RealtimeLogEntry[] => {
  const normalizedQuery = query.trim().toLowerCase();
  return logs.filter((entry) => (direction === "ALL" || entry.direction === direction) && (!normalizedQuery || [entry.eventName, entry.data, entry.direction].some((value) => value.toLowerCase().includes(normalizedQuery))));
};

export const serializeRealtimeLogs = (logs: RealtimeLogEntry[]): string => logs.map((entry) => `[${entry.timestamp}] ${entry.direction} ${entry.eventName}\n${entry.data}`).join("\n\n");
