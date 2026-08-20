import { useEffect, useMemo, useRef, useState } from "react";
import { UtilityHelpDialog, UtilityPageTitle } from "@/features/utility/components/UtilityHelpDialog";
import { ApiToolGuide } from "@/features/utility/components/ApiToolGuide";
import { ApiWorkspaceModuleNav } from "@/features/utility/components/ApiWorkspaceModuleNav";
import { copyText, downloadText } from "@/features/utility/utils/browserFileUtils";
import { filterRealtimeLogs, formatRealtimePayload, serializeRealtimeLogs, validateRealtimeUrl, type RealtimeLogDirection, type RealtimeLogEntry, type RealtimeProtocol } from "@/features/utility/utils/realtimeStreamUtils";
import { applicationNotification } from "@/shared/notification/applicationNotification";
import { createUuid } from "@/shared/lib/createUuid";

type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";

export const RealtimeTesterPage = () => {
  const [protocol, setProtocol] = useState<RealtimeProtocol>("WEBSOCKET");
  const [url, setUrl] = useState("wss://echo.websocket.events");
  const [subprotocols, setSubprotocols] = useState("");
  const [withCredentials, setWithCredentials] = useState(false);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [reconnectDelay, setReconnectDelay] = useState(3000);
  const [status, setStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [logs, setLogs] = useState<RealtimeLogEntry[]>([]);
  const [message, setMessage] = useState('{"type":"ping","message":"안녕하세요"}');
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"ALL" | RealtimeLogDirection>("ALL");
  const [helpOpen, setHelpOpen] = useState(false);
  const connectionReference = useRef<WebSocket | EventSource | undefined>(undefined);
  const reconnectTimerReference = useRef<number | undefined>(undefined);
  const manuallyClosedReference = useRef(false);
  const settingsReference = useRef({ protocol, url, subprotocols, withCredentials, autoReconnect, reconnectDelay });
  settingsReference.current = { protocol, url, subprotocols, withCredentials, autoReconnect, reconnectDelay };

  const appendLog = (directionValue: RealtimeLogDirection, eventName: string, data: unknown): void => {
    const entry: RealtimeLogEntry = { id: createUuid(), timestamp: new Date().toLocaleTimeString("ko-KR", { hour12: false }), direction: directionValue, eventName, data: formatRealtimePayload(data) };
    setLogs((currentLogs) => [...currentLogs, entry].slice(-500));
  };

  const closeConnection = (manual = true): void => {
    manuallyClosedReference.current = manual;
    if (reconnectTimerReference.current) window.clearTimeout(reconnectTimerReference.current);
    const connection = connectionReference.current;
    if (connection instanceof WebSocket) connection.close(1000, "사용자 종료"); else connection?.close();
    connectionReference.current = undefined;
    setStatus("DISCONNECTED");
    if (manual) appendLog("SYSTEM", "disconnect", "연결을 종료했습니다.");
  };

  const connect = (): void => {
    const settings = settingsReference.current;
    let parsedUrl: URL;
    try { parsedUrl = validateRealtimeUrl(settings.protocol, settings.url); } catch (error) { setStatus("ERROR"); appendLog("ERROR", "validation", error instanceof Error ? error.message : error); return; }
    closeConnection(false);
    manuallyClosedReference.current = false;
    setStatus("CONNECTING");
    appendLog("SYSTEM", "connect", `${settings.protocol} ${parsedUrl.toString()} 연결을 시작합니다.`);
    const scheduleReconnect = (): void => {
      if (manuallyClosedReference.current || !settingsReference.current.autoReconnect) return;
      const delay = Math.max(500, settingsReference.current.reconnectDelay);
      appendLog("SYSTEM", "reconnect", `${delay}ms 후 다시 연결합니다.`);
      reconnectTimerReference.current = window.setTimeout(connect, delay);
    };

    if (settings.protocol === "WEBSOCKET") {
      const protocols = settings.subprotocols.split(",").map((item) => item.trim()).filter(Boolean);
      const socket = protocols.length > 0 ? new WebSocket(parsedUrl, protocols) : new WebSocket(parsedUrl);
      connectionReference.current = socket;
      socket.addEventListener("open", () => { setStatus("CONNECTED"); appendLog("SYSTEM", "open", `연결되었습니다${socket.protocol ? ` · ${socket.protocol}` : ""}.`); });
      socket.addEventListener("message", (event) => appendLog("RECEIVED", "message", event.data));
      socket.addEventListener("error", () => { setStatus("ERROR"); appendLog("ERROR", "error", "WebSocket 연결 오류가 발생했습니다."); });
      socket.addEventListener("close", (event) => { connectionReference.current = undefined; setStatus("DISCONNECTED"); appendLog("SYSTEM", "close", `code=${event.code} reason=${event.reason || "없음"}`); scheduleReconnect(); });
      return;
    }
    const eventSource = new EventSource(parsedUrl, { withCredentials: settings.withCredentials });
    connectionReference.current = eventSource;
    eventSource.addEventListener("open", () => { setStatus("CONNECTED"); appendLog("SYSTEM", "open", "SSE 연결이 열렸습니다."); });
    eventSource.addEventListener("message", (event) => appendLog("RECEIVED", event.type, event.data));
    eventSource.addEventListener("error", () => {
      setStatus(eventSource.readyState === EventSource.CLOSED ? "ERROR" : "CONNECTING");
      appendLog("ERROR", "error", eventSource.readyState === EventSource.CLOSED ? "SSE 연결이 종료되었습니다." : "SSE가 재연결을 시도하고 있습니다.");
      if (eventSource.readyState === EventSource.CLOSED) scheduleReconnect();
    });
  };

  useEffect(() => () => {
    manuallyClosedReference.current = true;
    if (reconnectTimerReference.current) window.clearTimeout(reconnectTimerReference.current);
    const connection = connectionReference.current;
    if (connection instanceof WebSocket) connection.close(); else connection?.close();
  }, []);

  const visibleLogs = useMemo(() => filterRealtimeLogs(logs, query, direction), [direction, logs, query]);
  const sendMessage = (): void => {
    const connection = connectionReference.current;
    if (!(connection instanceof WebSocket) || connection.readyState !== WebSocket.OPEN) { applicationNotification.warning("연결된 WebSocket이 없습니다."); return; }
    connection.send(message);
    appendLog("SENT", "message", message);
  };
  const changeProtocol = (nextProtocol: RealtimeProtocol): void => {
    closeConnection(false); setProtocol(nextProtocol); setUrl(nextProtocol === "WEBSOCKET" ? "wss://echo.websocket.events" : "http://localhost:8080/api/events");
  };

  return (
    <section className="site-page utility-workbench-page advanced-utility-page realtime-page">
      <UtilityPageTitle kicker="Developer Utility · Realtime" title="WebSocket · SSE Tester" description="양방향 WebSocket과 단방향 Server-Sent Events 연결 상태와 메시지 흐름을 한 화면에서 확인합니다." onHelpOpen={() => setHelpOpen(true)} />
      <ApiWorkspaceModuleNav />
      <section className="advanced-panel realtime-connection-panel">
        <div className="utility-mode-tabs" role="tablist" aria-label="실시간 프로토콜"><button type="button" role="tab" aria-selected={protocol === "WEBSOCKET"} className={protocol === "WEBSOCKET" ? "active" : undefined} onClick={() => changeProtocol("WEBSOCKET")}>WebSocket</button><button type="button" role="tab" aria-selected={protocol === "SSE"} className={protocol === "SSE" ? "active" : undefined} onClick={() => changeProtocol("SSE")}>Server-Sent Events</button></div>
        <div className="realtime-url-row"><span className={`connection-status status-${status.toLowerCase()}`}>{status}</span><input aria-label="실시간 연결 URL" value={url} onChange={(event) => setUrl(event.target.value)} />{status === "CONNECTED" || status === "CONNECTING" ? <button type="button" className="danger-button" onClick={() => closeConnection()}>연결 종료</button> : <button type="button" onClick={connect}>연결</button>}</div>
        <div className="advanced-options-row">{protocol === "WEBSOCKET" ? <label>Subprotocols<input value={subprotocols} placeholder="graphql-transport-ws, chat" onChange={(event) => setSubprotocols(event.target.value)} /></label> : <label className="checkbox-label"><input type="checkbox" checked={withCredentials} onChange={(event) => setWithCredentials(event.target.checked)} />쿠키 포함</label>}<label className="checkbox-label"><input type="checkbox" checked={autoReconnect} onChange={(event) => setAutoReconnect(event.target.checked)} />자동 재연결</label><label>재연결 지연(ms)<input type="number" min={500} max={60000} value={reconnectDelay} onChange={(event) => setReconnectDelay(Number(event.target.value))} /></label></div>
      </section>
      <div className="realtime-workbench-grid">
        <section className="advanced-panel realtime-message-panel"><header><h2>메시지 보내기</h2><span>{protocol === "SSE" ? "SSE는 수신 전용입니다." : "Text·JSON"}</span></header><textarea aria-label="WebSocket 전송 메시지" value={message} disabled={protocol === "SSE"} spellCheck={false} onChange={(event) => setMessage(event.target.value)} /><div className="button-row"><button type="button" disabled={protocol === "SSE" || status !== "CONNECTED"} onClick={sendMessage}>메시지 전송</button><button type="button" className="ghost-button" disabled={protocol === "SSE"} onClick={() => { try { setMessage(JSON.stringify(JSON.parse(message), null, 2)); } catch { applicationNotification.warning("JSON 문법을 확인해 주세요."); } }}>JSON 정리</button></div><p className="utility-warning">브라우저 WebSocket은 임의 Authorization Header를 직접 설정할 수 없습니다. 쿠키·Query 또는 서버가 지원하는 Subprotocol을 사용해야 합니다.</p></section>
        <section className="advanced-panel realtime-log-panel"><header><div><h2>실시간 로그</h2><span>{visibleLogs.length}/{logs.length}개</span></div><div><button type="button" className="ghost-button" disabled={logs.length === 0} onClick={() => void copyText(serializeRealtimeLogs(logs)).then(() => applicationNotification.success("로그를 복사했습니다."))}>복사</button><button type="button" className="ghost-button" disabled={logs.length === 0} onClick={() => downloadText("realtime-log.txt", serializeRealtimeLogs(logs))}>내보내기</button><button type="button" className="ghost-button" disabled={logs.length === 0} onClick={() => setLogs([])}>비우기</button></div></header><div className="advanced-filter-row"><input aria-label="실시간 로그 검색" value={query} placeholder="메시지 검색" onChange={(event) => setQuery(event.target.value)} /><select aria-label="실시간 로그 방향" value={direction} onChange={(event) => setDirection(event.target.value as "ALL" | RealtimeLogDirection)}><option value="ALL">전체</option><option value="RECEIVED">수신</option><option value="SENT">전송</option><option value="SYSTEM">시스템</option><option value="ERROR">오류</option></select></div><div className="realtime-log-list">{visibleLogs.map((entry) => <article className={`log-${entry.direction.toLowerCase()}`} key={entry.id}><header><time>{entry.timestamp}</time><strong>{entry.direction}</strong><span>{entry.eventName}</span></header><pre>{entry.data}</pre></article>)}{visibleLogs.length === 0 ? <div className="portfolio-state-panel">연결하거나 메시지를 보내면 시간순으로 표시됩니다.</div> : null}</div></section>
      </div>
      <UtilityHelpDialog isOpen={helpOpen} title="WebSocket · SSE Tester" description="끊기지 않고 유지되는 연결에서 메시지가 오가는 것을 관찰합니다." onClose={() => setHelpOpen(false)}>
        <ApiToolGuide currentTool="REALTIME" />
        <article>
          <h3>WebSocket과 SSE 중 무엇을 고르나요?</h3>
          <ul>
            <li><strong>WebSocket</strong> — 브라우저와 서버가 <strong>서로</strong> 메시지를 보냅니다. 채팅, 협업 편집, 게임처럼 양쪽이 말해야 할 때.</li>
            <li><strong>SSE</strong> — <strong>서버만</strong> 보냅니다. 알림, 진행률, 로그 스트림처럼 받기만 하면 될 때.</li>
          </ul>
          <p>
            받기만 하면 되는데 WebSocket을 쓰면 불필요하게 복잡해집니다.
            SSE는 일반 HTTP 위에서 동작해 프록시·방화벽 문제도 적습니다.
          </p>
        </article>
        <article>
          <h3>사용 절차</h3>
          <ol>
            <li><strong>방식 선택</strong> — WebSocket 또는 SSE를 고릅니다.</li>
            <li><strong>주소 입력</strong> — WebSocket은 <code>ws://</code> 또는 <code>wss://</code>, SSE는 <code>http(s)://</code> 로 시작합니다.</li>
            <li><strong>연결</strong> — 연결 상태가 표시됩니다.</li>
            <li><strong>메시지 확인</strong> — 주고받은 메시지가 시간순으로 쌓입니다.</li>
            <li><strong>보내기</strong> — WebSocket만 가능합니다. SSE는 받기 전용이라 보내기 칸이 없습니다.</li>
          </ol>
        </article>
        <article>
          <h3>연결이 안 될 때</h3>
          <ul>
            <li>HTTPS 페이지에서는 <code>ws://</code> 를 쓸 수 없습니다. <code>wss://</code> 를 사용하세요.</li>
            <li>서버가 실시간 연결을 허용하는지, CORS 설정이 되어 있는지 확인하세요.</li>
            <li>연결이 바로 끊긴다면 인증이 필요한 엔드포인트일 수 있습니다.</li>
          </ul>
        </article>
        <article>
          <h3>코드로 만들 때 확인할 부분</h3>
          <p>컴포넌트가 사라질 때 연결과 재연결 타이머를 정리하고, 오류·종료·재연결 상태를 분리해야 합니다. 정리를 빠뜨리면 화면을 떠난 뒤에도 연결이 남아 메모리가 샙니다.</p>
        </article>
      </UtilityHelpDialog>
    </section>
  );
};
