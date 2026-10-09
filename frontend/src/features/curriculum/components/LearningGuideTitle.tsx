import type { ReactNode } from "react";
import { LearningGuideButton } from "@/features/curriculum/components/LearningGuideButton";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";
import type { FeatureHelpTopic } from "@/features/help/featureHelpGuides";
import { findLearningGuideById, ROADMAP_LAST_STAGE_NUMBER } from "@/features/curriculum/data/learningGuides";
import { OnlinePracticeMenu } from "@/features/curriculum/components/OnlinePracticeMenu";

interface LearningGuideTitleProperties {
  children: ReactNode;
  guideId?: string;
  helpTopic?: FeatureHelpTopic;
}

/**
 * 학습 화면의 큰 제목과 설명 모달 버튼을 한 줄에 배치합니다.
 * 페이지는 제목과 가이드 ID만 전달하고, 위치와 모달 UI는 이 컴포넌트가 책임집니다.
 */
export const LearningGuideTitle = ({ children, guideId, helpTopic }: LearningGuideTitleProperties) => {
  const learningGuide = guideId ? findLearningGuideById(guideId) : undefined;

  return (
    <div className="page-title-with-guide">
      <h1>{children}</h1>
      {learningGuide ? <LearningGuideButton learningGuide={learningGuide} /> : null}
      {/* 실제 연습 단계(1~25)에서만 온라인 실습 메뉴를 보여 준다. 0단계(로드맵 안내)·실험실은 해당 없음. */}
      {learningGuide && learningGuide.stageNumber > 0 && learningGuide.stageNumber <= ROADMAP_LAST_STAGE_NUMBER
        ? <OnlinePracticeMenu learningGuide={learningGuide} />
        : null}
      {helpTopic ? <FeatureHelpButton topic={helpTopic} /> : null}
    </div>
  );
};
