/**
 * StageSandboxSection.tsx — 연습 화면 맨 아래의 "직접 해 보기" 접기·펼치기 영역
 *
 * 학습 레이아웃(ApplicationLayout)이 모든 연습 화면 아래에 이 컴포넌트를 둔다.
 * 지금 주소에 맞는 학습 단계(1~25단계)일 때만 그리고, 평소에는 접혀 있어 연습 화면을 가리지 않는다.
 *
 * [접기·펼치기 버튼의 접근성]
 *   aria-expanded : 화면 낭독기에 "펼쳐짐/접힘" 상태를 알린다.
 *   aria-controls : 이 버튼이 어떤 영역을 여닫는지 연결한다.
 *
 * 편집기 본체(StageSandboxPanel)는 크므로 펼쳤을 때만 lazy()로 내려받는다.
 *
 * [상자 크기 조절]
 *   펼친 상자 오른쪽 아래 모서리(◢)를 끌면 상자 너비와 편집기 높이가 함께 바뀐다(학습 가이드 모달과 같은 사용법).
 *   너비는 본문 폭보다 커지지 않고(CSS max-width: 100%), 본문 폭까지 넓히면 "본문 폭 전체"(기본값)로 저장한다.
 */
import { lazy, Suspense, useRef } from "react";
import { useLocation } from "react-router-dom";
import { findLearningGuideByPathname, ROADMAP_LAST_STAGE_NUMBER } from "@/features/curriculum/data/learningGuides";
import { SandboxResizeHandle, type ResizeAxis } from "@/features/curriculum/components/SandboxResizeHandle";
import { SANDBOX_LAYOUT_HEIGHT_RANGE, STAGE_SANDBOX_SECTION_ID, useStageSandboxStore } from "@/features/curriculum/state/stageSandboxStore";

const StageSandboxPanel = lazy(() => import("@/features/curriculum/components/StageSandboxPanel"));

export const StageSandboxSection = () => {
  const location = useLocation();
  const learningGuide = findLearningGuideByPathname(location.pathname);
  const expandedGuideId = useStageSandboxStore((state) => state.expandedGuideId);
  const toggle = useStageSandboxStore((state) => state.toggle);
  const sectionWidth = useStageSandboxStore((state) => state.sectionWidth);
  const layoutHeight = useStageSandboxStore((state) => state.layoutHeight);
  const setSectionWidth = useStageSandboxStore((state) => state.setSectionWidth);
  const setLayoutHeight = useStageSandboxStore((state) => state.setLayoutHeight);
  const sectionRef = useRef<HTMLElement>(null);
  // 끌기 시작할 때의 포인터 위치와 크기. 이후 "시작 크기 + 움직인 거리"로 새 크기를 계산한다.
  const dragStartRef = useRef<{ clientX: number; clientY: number; width: number; height: number } | null>(null);

  /** 본문(상자 부모)에서 상자가 쓸 수 있는 최대 너비 */
  const getAvailableWidth = (): number => {
    const parentElement = sectionRef.current?.parentElement;
    if (!parentElement) return Number.POSITIVE_INFINITY;
    const parentStyle = getComputedStyle(parentElement);
    return parentElement.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight);
  };

  /** 새 너비를 저장한다. 본문 폭 이상이면 "본문 폭 전체"(null)로 저장해 화면이 넓어져도 같이 넓어지게 한다. */
  const changeSectionWidth = (nextWidth: number): void => {
    setSectionWidth(nextWidth >= getAvailableWidth() ? null : nextWidth);
  };

  const startCornerDrag = (clientX: number, clientY: number): void => {
    const sectionWidthNow = sectionRef.current?.getBoundingClientRect().width ?? 0;
    dragStartRef.current = { clientX, clientY, width: sectionWidthNow, height: useStageSandboxStore.getState().layoutHeight };
  };

  const dragCorner = (clientX: number, clientY: number): void => {
    const dragStart = dragStartRef.current;
    if (!dragStart) return;
    changeSectionWidth(dragStart.width + clientX - dragStart.clientX);
    setLayoutHeight(dragStart.height + clientY - dragStart.clientY);
  };

  /** 방향키: ←/→ 너비, ↑/↓ 높이. 지금 값은 화면(너비)과 getState()(높이)에서 최신 값을 읽는다. */
  const stepCorner = (axis: ResizeAxis, direction: -1 | 1, large: boolean): void => {
    const amount = direction * (large ? 120 : 40);
    if (axis === "x") changeSectionWidth((sectionRef.current?.getBoundingClientRect().width ?? 0) + amount);
    else setLayoutHeight(useStageSandboxStore.getState().layoutHeight + amount);
  };

  const resetSectionSize = (): void => {
    setSectionWidth(null);
    setLayoutHeight(SANDBOX_LAYOUT_HEIGHT_RANGE.initial);
  };

  // 로드맵 안내(0단계)·실험실·없는 주소에서는 그리지 않는다.
  if (!learningGuide || learningGuide.stageNumber < 1 || learningGuide.stageNumber > ROADMAP_LAST_STAGE_NUMBER) return null;
  // 펼친 단계와 지금 단계가 같을 때만 펼쳐 보인다(다른 단계로 이동하면 자동으로 접힘).
  const expanded = expandedGuideId === learningGuide.guideId;
  const panelId = `${STAGE_SANDBOX_SECTION_ID}-panel`;

  return (
    <section
      ref={sectionRef}
      // 펼쳤을 때만 저장된 너비를 쓴다(접힌 제목 줄은 항상 본문 폭).
      style={expanded && sectionWidth !== null ? { width: sectionWidth } : undefined}
      id={STAGE_SANDBOX_SECTION_ID}
      className={`stage-sandbox-section${expanded ? " expanded" : ""}`}
      aria-labelledby={`${STAGE_SANDBOX_SECTION_ID}-title`}
    >
      <button
        type="button"
        id={`${STAGE_SANDBOX_SECTION_ID}-title`}
        className="stage-sandbox-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => toggle(learningGuide.guideId)}
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        <strong>{learningGuide.stageNumber}단계 직접 해 보기</strong>
        <small>사이트 안 편집기에서 이 단계 연습 예제를 고쳐 바로 실행합니다</small>
      </button>
      {expanded ? (
        <div id={panelId} className="stage-sandbox-body">
          <Suspense fallback={<p className="state-panel" role="status">편집기를 불러오는 중입니다…</p>}>
            <StageSandboxPanel learningGuide={learningGuide} />
          </Suspense>
          <SandboxResizeHandle
            orientation="corner"
            label={`직접 해 보기 상자 크기 조절 (너비 ${sectionWidth === null ? "본문 폭 전체" : `${sectionWidth}px`}, 높이 ${layoutHeight}px)`}
            onDragStart={startCornerDrag}
            onDrag={dragCorner}
            onStep={stepCorner}
            onReset={resetSectionSize}
          />
        </div>
      ) : null}
    </section>
  );
};
