/**
 * SandboxResizeHandle.tsx — 사이트 안 편집기의 크기 조절 손잡이
 *
 *   orientation="vertical"   : 편집기와 미리보기 사이의 세로 막대. 좌우로 끌면 편집기·미리보기 너비 비율이 바뀐다.
 *   orientation="horizontal" : 편집기 아래의 가로 막대. 위아래로 끌면 높이가 바뀐다.
 *   orientation="corner"     : "직접 해 보기" 상자 오른쪽 아래 모서리(◢). 끌면 상자 너비와 높이가 함께 바뀐다.
 *
 * [마우스·터치] Pointer Events를 쓴다.
 *   setPointerCapture: 끄는 동안 포인터가 미리보기(iframe) 위로 지나가도 이벤트를 계속 이 손잡이가 받게 한다.
 *   (이걸 빼면 iframe 위에서 이벤트를 빼앗겨 끌기가 중간에 멈춘다)
 * [키보드] 손잡이에 포커스를 두고 방향키로 조절, Shift + 방향키는 크게, 더블클릭은 기본 크기로 되돌린다.
 *   (학습 가이드 모달의 크기 조절 손잡이와 같은 사용법)
 *
 * 손잡이는 "끌기 시작 위치·지금 포인터 위치"와 "방향키 방향"만 알려 주고, 실제 크기 계산은 부모가 한다.
 */
import { useRef, type KeyboardEvent, type PointerEvent } from "react";

/** 방향키가 바꾸는 축. x는 너비(←/→), y는 높이(↑/↓) */
export type ResizeAxis = "x" | "y";

interface SandboxResizeHandleProperties {
  orientation: "vertical" | "horizontal" | "corner";
  label: string; // 화면 낭독기에 읽히는 이름(현재 값 포함)
  onDragStart?: (clientX: number, clientY: number) => void; // 끌기 시작 위치가 필요할 때(모서리: 시작 크기 + 움직인 거리)
  onDrag: (clientX: number, clientY: number) => void;
  onStep: (axis: ResizeAxis, direction: -1 | 1, large: boolean) => void;
  onReset: () => void;
}

const ORIENTATION_SYMBOLS = { vertical: "⋮", horizontal: "⋯", corner: "◢" } as const;

export const SandboxResizeHandle = ({ orientation, label, onDragStart, onDrag, onStep, onReset }: SandboxResizeHandleProperties) => {
  // 지금 끌고 있는 포인터 번호. 화면을 다시 그릴 필요가 없는 값이라 State 대신 Ref에 둔다.
  const draggingPointerIdRef = useRef<number | null>(null);

  const handlePointerDown = (pointerEvent: PointerEvent<HTMLButtonElement>): void => {
    if (pointerEvent.button !== 0) return; // 왼쪽 버튼(터치 포함)만
    draggingPointerIdRef.current = pointerEvent.pointerId;
    pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
    pointerEvent.preventDefault(); // 끄는 동안 글자가 선택되지 않게
    onDragStart?.(pointerEvent.clientX, pointerEvent.clientY);
  };

  const handlePointerMove = (pointerEvent: PointerEvent<HTMLButtonElement>): void => {
    if (draggingPointerIdRef.current !== pointerEvent.pointerId) return;
    onDrag(pointerEvent.clientX, pointerEvent.clientY);
  };

  const finishDrag = (pointerEvent: PointerEvent<HTMLButtonElement>): void => {
    if (draggingPointerIdRef.current !== pointerEvent.pointerId) return;
    draggingPointerIdRef.current = null;
    if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) {
      pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId);
    }
  };

  const handleKeyDown = (keyboardEvent: KeyboardEvent<HTMLButtonElement>): void => {
    // 세로 막대는 ←/→(너비), 가로 막대는 ↑/↓(높이), 모서리는 네 방향 모두 쓴다.
    const keySteps: Record<string, [ResizeAxis, -1 | 1]> = {};
    if (orientation !== "horizontal") Object.assign(keySteps, { ArrowLeft: ["x", -1], ArrowRight: ["x", 1] });
    if (orientation !== "vertical") Object.assign(keySteps, { ArrowUp: ["y", -1], ArrowDown: ["y", 1] });
    const step = keySteps[keyboardEvent.key];
    if (!step) return;
    keyboardEvent.preventDefault(); // 방향키로 페이지가 스크롤되지 않게
    onStep(step[0], step[1], keyboardEvent.shiftKey);
  };

  return (
    <button
      type="button"
      className={`stage-sandbox-resize-handle ${orientation}`}
      aria-label={label}
      title="끌어서 크기 조절 · 방향키로도 조절 · 더블클릭하면 기본 크기"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
    >
      <span aria-hidden="true">{ORIENTATION_SYMBOLS[orientation]}</span>
    </button>
  );
};
