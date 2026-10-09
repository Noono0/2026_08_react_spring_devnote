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
 */
import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { findLearningGuideByPathname, ROADMAP_LAST_STAGE_NUMBER } from "@/features/curriculum/data/learningGuides";
import { STAGE_SANDBOX_SECTION_ID, useStageSandboxStore } from "@/features/curriculum/state/stageSandboxStore";

const StageSandboxPanel = lazy(() => import("@/features/curriculum/components/StageSandboxPanel"));

export const StageSandboxSection = () => {
  const location = useLocation();
  const learningGuide = findLearningGuideByPathname(location.pathname);
  const expandedGuideId = useStageSandboxStore((state) => state.expandedGuideId);
  const toggle = useStageSandboxStore((state) => state.toggle);

  // 로드맵 안내(0단계)·실험실·없는 주소에서는 그리지 않는다.
  if (!learningGuide || learningGuide.stageNumber < 1 || learningGuide.stageNumber > ROADMAP_LAST_STAGE_NUMBER) return null;
  // 펼친 단계와 지금 단계가 같을 때만 펼쳐 보인다(다른 단계로 이동하면 자동으로 접힘).
  const expanded = expandedGuideId === learningGuide.guideId;
  const panelId = `${STAGE_SANDBOX_SECTION_ID}-panel`;

  return (
    <section id={STAGE_SANDBOX_SECTION_ID} className={`stage-sandbox-section${expanded ? " expanded" : ""}`} aria-labelledby={`${STAGE_SANDBOX_SECTION_ID}-title`}>
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
        </div>
      ) : null}
    </section>
  );
};
