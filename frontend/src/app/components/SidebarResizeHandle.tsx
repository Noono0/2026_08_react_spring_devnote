/**
 * SidebarResizeHandle.tsx — 사이드바 오른쪽 가장자리의 너비 조절 손잡이 (PC 전용)
 *
 * [사용법]
 *   끌기         : 가장자리를 좌우로 끌면 사이드바가 넓어지고 좁아진다(240~520px).
 *   키보드       : 손잡이에 Tab으로 포커스 → ←/→ 20px, Shift + ←/→ 60px
 *   더블클릭     : 기본 너비(300px)로 되돌린다.
 *   (학습 가이드 모달의 크기 조절 손잡이와 같은 사용법)
 *
 * [원리]
 *   사이드바는 화면 왼쪽 끝(x = 0)에 붙어 있으므로 "포인터의 x 좌표 = 새 너비"다.
 *   setPointerCapture: 끄는 중 포인터가 본문(iframe 등) 위로 가도 이벤트를 계속 이 손잡이가 받게 한다.
 *   끄는 동안에는 <html data-sidebar-resizing>을 붙여 너비 애니메이션(transition)을 꺼서 손을 바로 따라오게 한다.
 */
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { SIDEBAR_WIDTH_RANGE, useApplicationUiStore } from "@/app/state/applicationUiStore";

const KEYBOARD_STEP = 20;

export const SidebarResizeHandle = () => {
  const sidebarWidth = useApplicationUiStore((state) => state.sidebarWidth);
  const setSidebarWidth = useApplicationUiStore((state) => state.setSidebarWidth);
  // 지금 끌고 있는 포인터 번호. 화면을 다시 그릴 필요가 없는 값이라 State 대신 Ref에 둔다.
  const draggingPointerIdRef = useRef<number | null>(null);

  const finishDrag = (pointerEvent: PointerEvent<HTMLButtonElement>): void => {
    if (draggingPointerIdRef.current !== pointerEvent.pointerId) return;
    draggingPointerIdRef.current = null;
    delete document.documentElement.dataset.sidebarResizing;
    if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId);
  };

  const handleKeyDown = (keyboardEvent: KeyboardEvent<HTMLButtonElement>): void => {
    if (keyboardEvent.key !== "ArrowLeft" && keyboardEvent.key !== "ArrowRight") return;
    keyboardEvent.preventDefault(); // 방향키로 화면이 스크롤되지 않게
    const step = (keyboardEvent.shiftKey ? KEYBOARD_STEP * 3 : KEYBOARD_STEP) * (keyboardEvent.key === "ArrowRight" ? 1 : -1);
    // getState(): 키를 빠르게 여러 번 눌러도 렌더링 때 받아 둔 옛 값이 아니라 최신 값으로 계산한다.
    setSidebarWidth(useApplicationUiStore.getState().sidebarWidth + step);
  };

  return (
    <button
      type="button"
      className="sidebar-resize-handle desktop-only-button"
      aria-label={`사이드바 너비 조절 (지금 ${sidebarWidth}px)`}
      title="끌어서 너비 조절 · ←/→ 키로도 조절 · 더블클릭하면 기본 너비"
      onPointerDown={(pointerEvent) => {
        if (pointerEvent.button !== 0) return; // 왼쪽 버튼(터치 포함)만
        draggingPointerIdRef.current = pointerEvent.pointerId;
        pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
        document.documentElement.dataset.sidebarResizing = "true";
        pointerEvent.preventDefault(); // 끄는 동안 글자가 선택되지 않게
      }}
      onPointerMove={(pointerEvent) => {
        if (draggingPointerIdRef.current === pointerEvent.pointerId) setSidebarWidth(pointerEvent.clientX);
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => setSidebarWidth(SIDEBAR_WIDTH_RANGE.initial)}
    />
  );
};
