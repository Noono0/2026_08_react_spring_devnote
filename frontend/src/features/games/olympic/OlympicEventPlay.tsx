/**
 * OlympicEventPlay.tsx — 올림픽 한 종목을 직접 하는 화면(혼자 연습·온라인 대전이 함께 쓴다)
 *
 * [게임 루프] requestAnimationFrame마다 olympicLogic.stepEvent로 진행하고 Canvas에 그린다.
 *   시뮬레이션 객체는 useState(() => …)로 한 번만 만들어 계속 같은 객체를 고친다(1초에 60번 바뀌므로 React State로 두지 않음).
 *   화면 글자(HUD)만 0.1초마다 React State로 옮겨 다시 그린다.
 * [입력] 키보드(←·→ 또는 Z·X = 달리기, 스페이스·↑ = 점프/던지기, 누른 채 각도)와 터치 버튼.
 *   키를 누르고 있으면 브라우저가 같은 키를 반복해 보내므로(event.repeat) 연타로 세지 않는다.
 *   채팅 입력칸에 글을 쓰는 중이면 게임 입력으로 쓰지 않는다.
 * [바깥과 주고받기] 달리기 종목은 0.25초마다 onProgress(달린 거리 cm), 종목이 끝나면 onFinish(기록) 한 번.
 */
import { useEffect, useRef, useState } from "react";
import { drawEvent, VIEW_HEIGHT, VIEW_WIDTH, type RivalLane } from "@/features/games/olympic/olympicDraw";
import { formatMark, olympicEvents, type OlympicEventId } from "@/features/games/olympic/olympicEvents";
import { applyInput, createEventState, raceProgress, stepEvent, type OlympicInput } from "@/features/games/olympic/olympicLogic";

interface OlympicEventPlayProps {
  event: OlympicEventId;
  color: string;
  rivals?: RivalLane[];
  onProgress?: (centimeters: number) => void;
  onFinish: (mark: number | null) => void;
}

interface Hud {
  message: string;
  speed: number;
  omega: number;
  time: number;
  angle: number;
  attempt: number;
  attemptMarks: (number | null)[];
  barHeight: number;
  phase: string;
}

const keyInputs: Record<string, "LEFT" | "RIGHT" | "ACTION"> = {
  ArrowLeft: "LEFT", KeyZ: "LEFT", KeyA: "LEFT",
  ArrowRight: "RIGHT", KeyX: "RIGHT", KeyD: "RIGHT",
  Space: "ACTION", ArrowUp: "ACTION", KeyC: "ACTION",
};

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export const OlympicEventPlay = ({ event, color, rivals = [], onProgress, onFinish }: OlympicEventPlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [simulation] = useState(() => createEventState(event));
  const latestRef = useRef({ rivals, onProgress, onFinish, color });
  const [hud, setHud] = useState<Hud>(() => ({ message: simulation.message, speed: 0, omega: 0, time: 0, angle: 0, attempt: 0, attemptMarks: [], barHeight: simulation.barHeight, phase: simulation.phase }));
  const info = olympicEvents[event];

  useEffect(() => {
    latestRef.current = { rivals, onProgress, onFinish, color };
  });

  const send = (input: OlympicInput) => applyInput(simulation, input);

  // 게임 루프: 진행 → 그리기 → (가끔) 글자·진행 거리 알리기 → 끝나면 기록 알리기
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d") ?? null;
    let frameId = 0;
    let last = performance.now();
    let lastHud = 0;
    let lastProgress = 0;
    let reported = false;
    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      stepEvent(simulation, dt);
      if (canvas && context) {
        const width = canvas.clientWidth || VIEW_WIDTH;
        const ratio = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(width * ratio)) {
          canvas.width = Math.round(width * ratio);
          canvas.height = Math.round((width * ratio * VIEW_HEIGHT) / VIEW_WIDTH);
        }
        context.setTransform(canvas.width / VIEW_WIDTH, 0, 0, canvas.height / VIEW_HEIGHT, 0, 0);
        drawEvent(context, simulation, { color: latestRef.current.color, rivals: latestRef.current.rivals });
      }
      if (now - lastHud > 100) {
        lastHud = now;
        setHud({
          message: simulation.message, speed: simulation.speed, omega: simulation.omega, time: simulation.raceTime, angle: simulation.angle,
          attempt: simulation.attempt, attemptMarks: simulation.attemptMarks, barHeight: simulation.barHeight, phase: simulation.phase,
        });
      }
      const progress = raceProgress(simulation);
      if (progress !== null && now - lastProgress > 250) {
        lastProgress = now;
        latestRef.current.onProgress?.(progress);
      }
      if (simulation.phase === "DONE" && !reported) {
        reported = true;
        if (progress !== null) latestRef.current.onProgress?.(progress);
        latestRef.current.onFinish(simulation.mark);
      }
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [simulation]);

  // 키보드
  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      const input = keyInputs[keyEvent.code];
      if (!input || isTypingTarget(keyEvent.target)) return;
      keyEvent.preventDefault();
      if (keyEvent.repeat) return;
      applyInput(simulation, input === "ACTION" ? "ACTION_DOWN" : input);
    };
    const onKeyUp = (keyEvent: KeyboardEvent) => {
      if (keyInputs[keyEvent.code] !== "ACTION" || isTypingTarget(keyEvent.target)) return;
      keyEvent.preventDefault();
      applyInput(simulation, "ACTION_UP");
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [simulation]);

  const actionLabel = event === "HURDLES_110" ? "점프 (스페이스)"
    : event === "HAMMER" ? "놓기 (스페이스)"
    : event === "JAVELIN" ? "던지기 (스페이스, 누른 채 각도)"
    : "점프 (스페이스, 누른 채 각도)";
  const showsAttempts = !info.timed;

  return (
    <div className="olympic-play">
      <div className="olympic-hud">
        <strong>{info.label}</strong>
        {info.timed ? <span>시간 {hud.time.toFixed(2)}초</span> : event === "HIGH_JUMP" ? <span>바 {(hud.barHeight / 100).toFixed(2)}m</span> : <span>{Math.min(hud.attempt + 1, info.attempts)} / {info.attempts}번째 시도</span>}
        <label className="olympic-meter">
          {event === "HAMMER" ? "회전" : "속도"}
          <progress max={event === "HAMMER" ? 16 : 12} value={event === "HAMMER" ? hud.omega : hud.speed} />
        </label>
        {hud.phase === "AIM" && <span>각도 {hud.angle.toFixed(0)}°</span>}
        <span className="olympic-wr">세계 기록 {info.worldRecord}</span>
      </div>
      <canvas ref={canvasRef} className="olympic-canvas" role="img" aria-label={`${info.label} 경기 화면`} />
      <p className="olympic-message" aria-live="polite">{hud.message}</p>
      {showsAttempts && hud.attemptMarks.length > 0 && (
        <ol className="olympic-attempts" aria-label="시도 기록">
          {hud.attemptMarks.map((mark, index) => (
            <li key={index}>{event === "HIGH_JUMP" ? (mark === null ? "×" : `○ ${formatMark(event, mark)}`) : formatMark(event, mark)}</li>
          ))}
        </ol>
      )}
      <div className="olympic-pad" aria-label="조작 버튼">
        <button type="button" className="olympic-key" onPointerDown={() => send("LEFT")}>◀ 왼발 (←·Z)</button>
        <button type="button" className="olympic-key" onPointerDown={() => send("RIGHT")}>오른발 (→·X) ▶</button>
        {event !== "SPRINT_100" && (
          <button
            type="button"
            className="olympic-key action"
            onPointerDown={() => send("ACTION_DOWN")}
            onPointerUp={() => send("ACTION_UP")}
            onPointerLeave={() => send("ACTION_UP")}
          >
            {actionLabel}
          </button>
        )}
      </div>
      <p className="online-hint">{info.howTo}</p>
    </div>
  );
};
