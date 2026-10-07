/**
 * LearningGuideButton.tsx — 학습 화면 제목 옆의 ? 버튼과 학습 가이드 대화상자
 *
 * 버튼을 누르면 ModalDialog(공통 대화상자)가 열리고, 네 개의 탭으로 learningGuides.ts의 내용을 보여 준다.
 * 탭은 role="tablist"·role="tab"·aria-selected로 화면 낭독기에도 "탭"으로 읽히게 했다.
 */
import { useState } from "react";
import type { LearningGuide } from "@/features/curriculum/data/learningGuides";
import { ModalDialog } from "@/shared/ui/ModalDialog";

// 탭 종류. 문자열 합집합 타입이라 오타가 나면 TypeScript가 잡아 준다.
type GuideTab = "USAGE" | "LEARNING" | "FLOW" | "PRACTICE";

interface LearningGuideButtonProps {
  learningGuide: LearningGuide;
}

const guideTabLabelMap: Record<GuideTab, string> = {
  USAGE: "사용 방법",
  LEARNING: "학습 내용",
  FLOW: "소스 흐름",
  PRACTICE: "실습 과제",
};

export const LearningGuideButton = ({ learningGuide }: LearningGuideButtonProps) => {
  const [isGuideOpen, setGuideOpen] = useState(false);
  const [selectedGuideTab, setSelectedGuideTab] = useState<GuideTab>("USAGE");

  // 열 때마다 첫 탭(사용 방법)부터 보여 준다.
  const openGuide = (): void => {
    setSelectedGuideTab("USAGE");
    setGuideOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="learning-guide-icon-button"
        onClick={openGuide}
        aria-label={`${learningGuide.title} 학습 가이드 열기`}
        title="이 화면 사용 설명서와 학습 내용"
      >
        <span aria-hidden="true">?</span>
      </button>

      <ModalDialog
        isOpen={isGuideOpen}
        title={`${learningGuide.stageNumber > 0 ? `${learningGuide.stageNumber}단계 · ` : ""}${learningGuide.title}`}
        description={`${learningGuide.level} · 난이도 ${learningGuide.difficultyScore}/10 · ${learningGuide.description}`}
        resizable
        // 사용자가 늘린 대화상자 크기를 가이드별로 기억한다.
        resizeStorageKey={`learning-guide:${learningGuide.title}`}
        onRequestClose={() => setGuideOpen(false)}
        footer={<button type="button" onClick={() => setGuideOpen(false)}>확인하고 닫기</button>}
      >
        <div className="learning-guide-tabs" role="tablist" aria-label="학습 가이드 메뉴">
          {/* Object.keys는 string[]을 돌려주므로 GuideTab[]으로 좁힌다(표의 키가 곧 탭 종류). */}
          {(Object.keys(guideTabLabelMap) as GuideTab[]).map((guideTab) => (
            <button
              key={guideTab}
              type="button"
              role="tab"
              aria-selected={selectedGuideTab === guideTab}
              className={selectedGuideTab === guideTab ? "active" : ""}
              onClick={() => setSelectedGuideTab(guideTab)}
            >
              {guideTabLabelMap[guideTab]}
            </button>
          ))}
        </div>

        {/* 선택된 탭의 내용만 그린다. 목록의 key는 문장 자체(같은 가이드 안에서 문장이 겹치지 않는다). */}
        {selectedGuideTab === "USAGE" ? (
          <section className="learning-guide-section">
            <h3>화면 사용 순서</h3>
            <ol>{learningGuide.usageSteps.map((usageStep) => <li key={usageStep}>{usageStep}</li>)}</ol>
            <h3>자주 발생하는 실수</h3>
            <ul>{learningGuide.commonMistakes.map((commonMistake) => <li key={commonMistake}>{commonMistake}</li>)}</ul>
          </section>
        ) : null}

        {selectedGuideTab === "LEARNING" ? (
          <section className="learning-guide-section">
            <h3>이번 화면에서 배우는 내용</h3>
            <div className="learning-topic-grid">
              {learningGuide.learningTopics.map((learningTopic) => <span key={learningTopic}>{learningTopic}</span>)}
            </div>
            <h3>관련 소스 파일</h3>
            <ul className="source-file-list">{learningGuide.relatedFiles.map((relatedFile) => <li key={relatedFile}><code>{relatedFile}</code></li>)}</ul>
          </section>
        ) : null}

        {selectedGuideTab === "FLOW" ? (
          <section className="learning-guide-section">
            <h3>실행 흐름</h3>
            <div className="learning-flow-list">
              {learningGuide.sourceFlow.map((sourceFlowStep, sourceFlowIndex) => (
                <div key={sourceFlowStep}>
                  <span>{sourceFlowIndex + 1}</span>
                  <strong>{sourceFlowStep}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {selectedGuideTab === "PRACTICE" ? (
          <section className="learning-guide-section">
            <h3>직접 수정해 볼 과제</h3>
            <ol>{learningGuide.practiceTasks.map((practiceTask) => <li key={practiceTask}>{practiceTask}</li>)}</ol>
            <p className="notice-box">기능을 먼저 사용한 뒤, 관련 파일을 열어 작은 항목부터 직접 수정해 보세요.</p>
          </section>
        ) : null}
      </ModalDialog>
    </>
  );
};
