import { useState, type MouseEvent } from "react";
import { useCloseCrawlerLiveView, useCrawlerLiveView, useCrawlerManualAction } from "@/features/crawler/hooks/useWebCrawler";

const stepStatusIcon: Record<string, string> = {
  PENDING: "○", RUNNING: "▶", DONE: "✔", BLOCKED: "⚠", WAITING: "✋", SKIPPED: "↷", FAILED: "✖",
};
const stepStatusLabel: Record<string, string> = {
  PENDING: "대기", RUNNING: "진행 중", DONE: "완료", BLOCKED: "막힘", WAITING: "직접 처리 대기", SKIPPED: "건너뜀", FAILED: "실패",
};

export const CrawlerLiveViewPanel = ({ running }: { running: boolean }) => {
  const liveViewQuery = useCrawlerLiveView(true, running);
  const manualActionMutation = useCrawlerManualAction();
  const closeMutation = useCloseCrawlerLiveView();
  const [manualText, setManualText] = useState("");
  const liveView = liveViewQuery.data;
  // 실패 후에도 브라우저를 열어 둔 상태면 화면을 직접 조작할 수 있다.
  const inspecting = !running && liveView?.inspecting === true;
  // PC에 실제 Chromium 창이 보이는 실행(directWindow)이면 그 창에서 직접 조작하므로 웹 원격 조작을 쓰지 않는다.
  const directWindow = liveView?.directWindow === true;
  const waitingForUser = liveView?.manualActionRequired === true;
  const recording = liveView?.recording === true;
  const manualMode = !directWindow && (waitingForUser || inspecting || recording);
  const stepStatuses = liveView?.steps ?? [];
  const blockedStep = stepStatuses.find((step) => step.status === "BLOCKED" || step.status === "WAITING");
  const sendControl = (action: "CONTINUE" | "RETRY" | "SKIP" | "STOP"): void => {
    manualActionMutation.mutate({ action });
  };

  const clickBrowser = (event: MouseEvent<HTMLImageElement>): void => {
    if (!manualMode || manualActionMutation.isPending) return;
    const image = event.currentTarget;
    const bounds = image.getBoundingClientRect();
    const naturalWidth = image.naturalWidth || 1280;
    const naturalHeight = image.naturalHeight || 720;
    const scale = Math.min(bounds.width / naturalWidth, bounds.height / naturalHeight);
    const renderedWidth = naturalWidth * scale;
    const renderedHeight = naturalHeight * scale;
    const offsetX = (bounds.width - renderedWidth) / 2;
    const offsetY = (bounds.height - renderedHeight) / 2;
    const x = (event.clientX - bounds.left - offsetX) / scale;
    const y = (event.clientY - bounds.top - offsetY) / scale;
    if (x < 0 || y < 0 || x > naturalWidth || y > naturalHeight) return;
    manualActionMutation.mutate({ action: "CLICK", x, y });
  };

  const sendText = (): void => {
    if (!manualText.trim()) return;
    manualActionMutation.mutate(
      { action: "TYPE", text: manualText },
      { onSuccess: () => setManualText("") },
    );
  };

  const sendKey = (key: "Enter" | "Tab" | "Backspace"): void => {
    manualActionMutation.mutate({ action: "KEY", text: key });
  };

  return (
    <section className={`crawler-live-view${manualMode ? " manual-mode" : ""}`} aria-live="polite">
      <header>
        <div>
          <span className={liveView?.active ? "active" : ""} aria-hidden="true" />
          <div>
            <strong>{running ? "실시간 Chromium 화면" : inspecting ? "실패한 Chromium 화면 (열려 있음)" : "마지막 Chromium 화면"}</strong>
            <small>{liveView?.stage || "브라우저 화면을 준비하는 중입니다."}</small>
          </div>
        </div>
        {inspecting ? (
          <button type="button" className="danger-button" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate()}>브라우저 닫기</button>
        ) : (
          <code>{manualMode || (directWindow && waitingForUser) ? "사용자 조작 대기" : running ? "headless: false" : "실패 화면 유지"}</code>
        )}
      </header>
      {!running && liveView?.runStatus === "FAILURE" ? (
        <div className="crawler-live-failure" role="note">
          <small>실행 종료 이유 · {liveView.stage}</small>
          <strong>{liveView.finalReason || "실행을 완료하지 못했습니다."}</strong>
          {liveView.suggestedAction ? <p><b>내가 해야 할 일</b>{liveView.suggestedAction}</p> : null}
        </div>
      ) : null}
      {stepStatuses.length > 0 ? (
        <ol className="crawler-step-progress" aria-label="단계 진행 상황">
          {stepStatuses.map((step) => (
            <li key={step.index} className={`status-${step.status.toLowerCase()}`}>
              <span aria-hidden="true">{stepStatusIcon[step.status]}</span>
              <span>{step.index + 1}. {step.label}</span>
              <small>{stepStatusLabel[step.status]}{step.detail ? ` · ${step.detail}` : ""}</small>
            </li>
          ))}
        </ol>
      ) : null}
      {blockedStep && waitingForUser ? (
        <div className="crawler-step-controls" role="group" aria-label="막힌 단계 처리">
          <strong>{blockedStep.status === "BLOCKED" ? `${blockedStep.index + 1}단계에서 막혔습니다` : `${blockedStep.index + 1}단계: 직접 처리해 주세요`}</strong>
          <p>{liveView?.manualActionMessage}</p>
          <div>
            <button type="button" className="primary-button" disabled={manualActionMutation.isPending} onClick={() => sendControl("CONTINUE")}>계속 (직접 처리함)</button>
            <button type="button" className="secondary-button" disabled={manualActionMutation.isPending} onClick={() => sendControl("RETRY")}>다시 시도</button>
            <button type="button" className="secondary-button" disabled={manualActionMutation.isPending} onClick={() => sendControl("SKIP")}>건너뛰기</button>
            <button type="button" className="danger-button" disabled={manualActionMutation.isPending} onClick={() => sendControl("STOP")}>중단</button>
          </div>
          {directWindow ? <small>PC에 열린 브라우저 창에서 직접 처리한 뒤 위 버튼을 눌러 주세요.</small> : <small>아래 화면을 직접 클릭·입력해 처리할 수 있습니다.</small>}
        </div>
      ) : null}
      {blockedStep && waitingForUser ? null : directWindow && waitingForUser ? (
        <div className="crawler-manual-notice" role="status">
          <strong>PC에 열린 브라우저 창에서 직접 인증해 주세요</strong>
          <p>{liveView.manualActionMessage}</p>
          <ol>
            <li>작업 표시줄에서 크롤링용 브라우저 창을 엽니다.</li>
            <li>캡차 답이나 인증번호를 그 창에서 직접 클릭·입력합니다.</li>
            <li>Playwright Inspector 창이 함께 열렸다면 Resume(▶)을 누르고, 없다면 인증이 끝나는 대로 자동으로 이어집니다.</li>
          </ol>
        </div>
      ) : inspecting ? (
        <div className="crawler-manual-notice" role="status">
          <strong>브라우저를 닫지 않고 그대로 열어 두었습니다</strong>
          <p>{directWindow
            ? "PC에 열린 Chromium 창에서 실패한 화면을 직접 확인할 수 있습니다. 확인이 끝나면 ‘브라우저 닫기’를 누르세요."
            : "실패한 화면을 직접 클릭하거나 입력해서 원인을 확인할 수 있습니다. 확인이 끝나면 ‘브라우저 닫기’를 누르세요."}</p>
        </div>
      ) : manualMode && !recording ? (
        <div className="crawler-manual-notice" role="status">
          <strong>직접 확인이 필요합니다</strong>
          <p>{liveView.manualActionMessage}</p>
          <ol>
            <li>아래 화면에서 입력할 곳이나 버튼을 직접 클릭합니다.</li>
            <li>글자가 필요하면 답을 작성하고 ‘선택한 곳에 입력’을 누릅니다.</li>
            <li>화면의 확인 버튼을 클릭하거나 Enter를 누릅니다.</li>
          </ol>
        </div>
      ) : null}
      {liveView?.imageDataUrl ? (
        <img
          className={manualMode ? "interactive" : ""}
          src={liveView.imageDataUrl}
          alt={`Playwright 실행 화면: ${liveView.stage}`}
          onClick={clickBrowser}
        />
      ) : (
        <div className="crawler-live-view-empty">Chromium이 시작되면 이곳에 실행 화면이 표시됩니다.</div>
      )}
      {manualMode ? (
        <div className="crawler-manual-controls">
          <label>직접 입력할 값<input value={manualText} onChange={(event) => setManualText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendText(); } }} placeholder="화면에서 요구하는 답 또는 인증번호" /></label>
          <button type="button" className="primary-button" disabled={!manualText.trim() || manualActionMutation.isPending} onClick={sendText}>선택한 곳에 입력</button>
          <button type="button" className="secondary-button" disabled={manualActionMutation.isPending} onClick={() => sendKey("Enter")}>Enter</button>
          <button type="button" className="secondary-button" disabled={manualActionMutation.isPending} onClick={() => sendKey("Tab")}>Tab</button>
          <button type="button" className="secondary-button" disabled={manualActionMutation.isPending} onClick={() => sendKey("Backspace")}>지우기</button>
          {manualActionMutation.isError ? <p className="field-error">조작을 전달하지 못했습니다. 브라우저가 아직 열려 있는지 확인해 주세요.</p> : null}
        </div>
      ) : null}
      <p>{inspecting
        ? "실패 원인을 확인할 수 있도록 Chromium을 최대 10분 동안 열어 둡니다. 다음 실행을 시작하면 자동으로 닫힙니다."
        : manualMode
        ? "최대 10분 동안 이 화면을 유지합니다. 인증이 완료되면 Playwright가 자동으로 다음 작업을 계속합니다."
        : running
          ? "화면은 약 0.7초마다 확인하며 주요 동작 단계에서 갱신됩니다."
          : "실행은 종료됐지만 원인을 확인할 수 있도록 마지막 화면을 유지하고 있습니다. 다음 실행을 시작하면 새 화면으로 바뀝니다."}</p>
    </section>
  );
};
