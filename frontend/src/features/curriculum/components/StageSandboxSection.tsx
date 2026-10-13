/**
 * StageSandboxSection.tsx — 학습 단계 연습 화면 맨 아래의 "직접 해 보기" 상자
 *
 * 학습 레이아웃(ApplicationLayout)이 모든 연습 화면 아래에 이 컴포넌트를 둔다.
 * 지금 주소에 맞는 학습 단계(1~25단계)일 때만 그리고, 상자 자체(접기·크게 보기·크기 조절)는
 * 게임 규칙 연습 화면(GameExercisePage)과 함께 쓰는 PracticeSandboxSection이 그린다.
 */
import { useLocation } from "react-router-dom";
import { PracticeSandboxSection } from "@/features/curriculum/components/PracticeSandboxSection";
import { findLearningGuideByPathname, ROADMAP_LAST_STAGE_NUMBER } from "@/features/curriculum/data/learningGuides";

export const StageSandboxSection = () => {
  const location = useLocation();
  const learningGuide = findLearningGuideByPathname(location.pathname);

  // 로드맵 안내(0단계)·실험실·없는 주소에서는 그리지 않는다.
  if (!learningGuide || learningGuide.stageNumber < 1 || learningGuide.stageNumber > ROADMAP_LAST_STAGE_NUMBER) return null;

  return (
    <PracticeSandboxSection
      // key: 다른 단계로 옮겨 가면 상자를 새로 만든다(크기 계산용 ref 등이 이전 단계 값으로 남지 않게).
      key={learningGuide.guideId}
      sandboxId={learningGuide.guideId}
      heading={`${learningGuide.stageNumber}단계 직접 해 보기`}
      description="사이트 안 편집기에서 이 단계 연습 예제를 고쳐 바로 실행합니다"
    />
  );
};
