/**
 * ============================================================================
 * realtimeStreamUtils.ts — WebSocket · SSE 테스터의 보조 함수
 * ============================================================================
 *
 * 실시간 연결 화면에서 쓰는 순수 함수를 모았다.
 * 연결을 실제로 여는 코드(WebSocket/EventSource)는 화면 쪽에 있고,
 * 여기에는 "검증·형식 변환·필터링"처럼 테스트 가능한 계산만 둔다.
 *
 * ★ 이렇게 나누면 연결 없이도 로직을 검증할 수 있다.
 *   (realtimeStreamUtils.test.ts 참고)
 */

export type RealtimeProtocol = "WEBSOCKET" | "SSE";

/**
 * 로그 한 줄의 방향.
 *   SYSTEM   연결·종료 같은 상태 알림
 *   SENT     내가 보낸 메시지 (WebSocket만 해당)
 *   RECEIVED 서버가 보낸 메시지
 *   ERROR    오류
 *
 * ★ 네 가지를 구분해 두면 화면에서 색을 다르게 주고 필터링도 할 수 있다.
 *   전부 한 덩어리로 쌓으면 무엇이 오간 건지 읽기 어렵다.
 */
export type RealtimeLogDirection = "SYSTEM" | "SENT" | "RECEIVED" | "ERROR";

export interface RealtimeLogEntry {
  id: string;
  timestamp: string;
  direction: RealtimeLogDirection;
  eventName: string;
  data: string;
}

/**
 * 연결 주소가 올바른지 확인한다.
 *
 * ★ 프로토콜별로 허용 스킴이 다르다는 점이 핵심이다.
 *     WebSocket → ws:// 또는 wss://
 *     SSE       → http:// 또는 https://  (SSE는 일반 HTTP 위에서 동작한다)
 *
 *   이 검사가 없으면 사용자가 SSE 칸에 ws:// 를 넣었을 때
 *   브라우저가 알아보기 힘든 오류를 내고 원인을 찾기 어렵다.
 *   여기서 미리 막고 무엇이 잘못됐는지 한국어로 알려 준다.
 *
 * ★ 오류를 던지되(throw) 각 경우마다 다른 문구를 준다.
 *   "올바르지 않습니다" 하나로 뭉뚱그리면 무엇을 고쳐야 할지 알 수 없다.
 *
 * new URL(...) 은 형식이 틀리면 예외를 던지므로 try/catch 로 감싼다.
 * catch 뒤에 (error) 를 안 적은 것은 "오류 내용은 안 쓰고 우리 문구로 바꾼다"는 뜻이다.
 */
export const validateRealtimeUrl = (protocol: RealtimeProtocol, value: string): URL => {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("올바른 연결 URL을 입력해 주세요."); }
  if (protocol === "WEBSOCKET" && !["ws:", "wss:"].includes(url.protocol)) throw new Error("WebSocket 주소는 ws:// 또는 wss://로 시작해야 합니다.");
  if (protocol === "SSE" && !["http:", "https:"].includes(url.protocol)) throw new Error("SSE 주소는 http:// 또는 https://로 시작해야 합니다.");
  return url;
};

/**
 * 받은 메시지를 화면에 보여줄 글자로 바꾼다.
 *
 * ★ WebSocket 메시지는 글자만 오는 게 아니다.
 *   Blob(이진 데이터)이나 ArrayBuffer 로 올 수도 있어
 *   그대로 화면에 넣으면 "[object Blob]" 같은 쓸모없는 글자가 찍힌다.
 *   이진 데이터는 내용 대신 "크기"를 보여주는 편이 유용하다.
 *
 * ★ 그 다음 JSON 이면 보기 좋게 들여쓴다.
 *   한 줄로 온 JSON은 읽기 어렵기 때문이다.
 *   JSON이 아니면 파싱이 실패하므로 원문을 그대로 쓴다.
 *   (오류를 내지 않고 조용히 원문으로 되돌아가는 게 이 함수의 의도다)
 */
export const formatRealtimePayload = (value: unknown): string => {
  const text = typeof value === "string" ? value : value instanceof Blob ? `[Blob ${value.size.toLocaleString("ko-KR")} bytes]` : value instanceof ArrayBuffer ? `[ArrayBuffer ${value.byteLength.toLocaleString("ko-KR")} bytes]` : String(value);
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
};

/**
 * 로그를 검색어와 방향으로 걸러낸다.
 *
 * 조건 두 개를 모두 만족해야 남는다.
 *   1) 방향이 "ALL" 이거나 선택한 방향과 같다
 *   2) 검색어가 비었거나, 이벤트명·내용·방향 중 하나에 포함된다
 *
 * `!normalizedQuery ||` 로 "검색어 없음 = 전부 통과"를 표현한 관용구다.
 * some() 은 세 항목 중 하나만 맞아도 true 를 돌려준다.
 */
export const filterRealtimeLogs = (logs: RealtimeLogEntry[], query: string, direction: "ALL" | RealtimeLogDirection): RealtimeLogEntry[] => {
  const normalizedQuery = query.trim().toLowerCase();
  return logs.filter((entry) => (direction === "ALL" || entry.direction === direction) && (!normalizedQuery || [entry.eventName, entry.data, entry.direction].some((value) => value.toLowerCase().includes(normalizedQuery))));
};

/**
 * 로그 전체를 텍스트 파일로 내보낼 형태로 만든다.
 *
 * 항목 사이를 빈 줄(\n\n)로 띄우는 이유:
 * 메시지 본문 자체가 여러 줄일 수 있어(JSON 들여쓰기 등),
 * 한 줄 간격만 두면 어디서 항목이 바뀌는지 알아보기 어렵다.
 */
export const serializeRealtimeLogs = (logs: RealtimeLogEntry[]): string => logs.map((entry) => `[${entry.timestamp}] ${entry.direction} ${entry.eventName}\n${entry.data}`).join("\n\n");
