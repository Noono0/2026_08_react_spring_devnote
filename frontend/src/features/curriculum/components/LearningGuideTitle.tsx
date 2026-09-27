import type { ReactNode } from "react";
import { LearningGuideButton } from "@/features/curriculum/components/LearningGuideButton";
import { findLearningGuideById } from "@/features/curriculum/data/learningGuides";

interface LearningGuideTitleProperties {
  children: ReactNode;
  guideId?: string;
}

/**
 * 학습 화면의 큰 제목과 설명 모달 버튼을 한 줄에 배치합니다.
 * 페이지는 제목과 가이드 ID만 전달하고, 위치와 모달 UI는 이 컴포넌트가 책임집니다.
 */
export const LearningGuideTitle = ({ children, guideId }: LearningGuideTitleProperties) => {
  const learningGuide = guideId ? findLearningGuideById(guideId) : undefined;

  return (
    <div className="page-title-with-guide">
      <h1>{children}</h1>
      {learningGuide ? <LearningGuideButton learningGuide={learningGuide} /> : null}
    </div>
  );
};
