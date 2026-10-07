import { Link } from "react-router-dom";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { ADVANCED_TOPIC_FIRST_STAGE_NUMBER, learningStageRoutes, roadmapLearningGuides, type LearningGuide } from "@/features/curriculum/data/learningGuides";
import { useLearningProgressStore } from "@/features/curriculum/state/learningProgressStore";

// 1~14단계는 난이도로, 15단계부터는 "심화" 묶음으로 보여 준다. (심화는 CRUD를 마친 뒤 실무 주제를 다룬다)
const stageGroupDescriptions = {
  "기초·초급": "React 상태와 가장 단순한 CRUD 흐름을 익힙니다.",
  중급: "화면 패턴과 데이터 구조, 업무 규칙을 다양하게 경험합니다.",
  고급: "권한·트리·파일·백엔드·대량 처리를 연습합니다.",
  심화: "CRUD를 마친 뒤 커스텀 훅·성능·전역 상태·URL 상태·접근성·Suspense·테스트 같은 실무 주제를 다룹니다.",
} as const;
type StageGroupLabel = keyof typeof stageGroupDescriptions;

const getStageGroupLabel = (learningGuide: LearningGuide): StageGroupLabel => {
  if (learningGuide.stageNumber >= ADVANCED_TOPIC_FIRST_STAGE_NUMBER) return "심화";
  if (learningGuide.difficultyScore <= 3) return "기초·초급";
  if (learningGuide.difficultyScore < 8) return "중급";
  return "고급";
};

export const LearningRoadmapPage = () => {
  // 완료한 단계 목록과 토글 함수만 골라 구독한다(learningProgressStore.ts).
  const completedStageIds = useLearningProgressStore((state) => state.completedStageIds);
  const toggleStageCompleted = useLearningProgressStore((state) => state.toggleStageCompleted);
  // 저장소에는 지금 로드맵에 없는 옛 단계 ID가 남아 있을 수 있으므로, 현재 단계 중 완료한 것만 센다.
  const completedStageCount = roadmapLearningGuides.filter((learningGuide) => completedStageIds.includes(learningGuide.guideId)).length;

  return (
    <section className="learning-page">
      <div className="page-hero">
        <span className="page-kicker">React Beginner → Advanced CRUD Lab</span>
        <LearningGuideTitle guideId="roadmap">React 기초부터 실무 문제 해결까지 배우는 로드맵</LearningGuideTitle>
        <p>
          같은 CRUD라도 데이터 구조와 업무 규칙, 화면 패턴이 다르면 구현 방법도 달라집니다.
          상태 → Reducer → 폼 → Effect·비동기 → CRUD → 권한 → 트리 → 실제 백엔드 순서로 학습합니다.
        </p>
      </div>
  
      <div className="roadmap-summary-grid">
        <article><strong>{roadmapLearningGuides.length}개</strong><span>난이도별 React 실습 단계</span></article>
        <article><strong>8종</strong><span>인라인·모달·페이지·계층·트리 등 UI 패턴</span></article>
        <article><strong>ON/OFF</strong><span>실제 백엔드와 MSW 더미 전환</span></article>
        <article><strong>?</strong><span>모든 화면 학습 가이드 모달</span></article>
      </div>
  
      {/* 학습 진도. <progress>는 화면 낭독기가 "25 중 3" 같은 진행률로 읽어 주는 기본 요소다. */}
      <div className="roadmap-progress">
        <div>
          <strong>내 학습 진도</strong>
          <span>{completedStageCount} / {roadmapLearningGuides.length}단계 완료 · 이 브라우저에 저장됩니다.</span>
        </div>
        <progress max={roadmapLearningGuides.length} value={completedStageCount} aria-label="완료한 학습 단계 비율" />
      </div>
  
      {(Object.keys(stageGroupDescriptions) as StageGroupLabel[]).map((stageGroupLabel) => (
        <section className="roadmap-stage-section" key={stageGroupLabel}>
          <div className="roadmap-section-heading">
            <h2>{stageGroupLabel}</h2>
            <p>{stageGroupDescriptions[stageGroupLabel]}</p>
          </div>
          <div className="roadmap-grid">
            {roadmapLearningGuides.filter((learningGuide) => getStageGroupLabel(learningGuide) === stageGroupLabel).map((learningGuide) => {
              const isCompleted = completedStageIds.includes(learningGuide.guideId);
              return (
                <article className={`roadmap-card${isCompleted ? " completed" : ""}`} key={learningGuide.guideId}>
                  <div className="roadmap-card-heading">
                    <span className="roadmap-stage-number">{learningGuide.stageNumber}</span>
                    <div className="roadmap-badge-row">
                      <span className={`level-badge level-${learningGuide.level}`}>{learningGuide.level}</span>
                      <span className="difficulty-badge">난이도 {learningGuide.difficultyScore}/10</span>
                    </div>
                  </div>
                  <h2>{learningGuide.title}</h2>
                  <p>{learningGuide.description}</p>
                  <ul className="topic-chip-list">
                    {learningGuide.learningTopics.slice(0, 5).map((learningTopic) => <li key={learningTopic}>{learningTopic}</li>)}
                  </ul>
                  <div className="roadmap-card-actions">
                    <Link className="primary-link" to={learningStageRoutes[learningGuide.guideId] ?? "/react"}>단계 시작하기</Link>
                    {/* 버튼 이름에 단계 제목을 넣어, 화면 낭독기로 버튼만 훑어도 어느 단계인지 알 수 있게 한다. */}
                    <button
                      type="button"
                      className="secondary-button"
                      aria-pressed={isCompleted}
                      aria-label={`${learningGuide.stageNumber}단계 ${learningGuide.title} 완료 표시`}
                      onClick={() => toggleStageCompleted(learningGuide.guideId)}
                    >
                      {isCompleted ? "✓ 완료" : "완료 표시"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
  
      <article className="learning-note-card roadmap-learning-method">
        <h2>각 단계를 배우는 방법</h2>
        <ol>
          <li>화면에서 생성·조회·수정·삭제를 모두 실행합니다.</li>
          <li>큰 제목 옆의 <strong>?</strong> 아이콘을 눌러 사용 방법과 핵심 개념을 확인합니다.</li>
          <li>학습 가이드의 소스 흐름 순서대로 파일을 찾아갑니다.</li>
          <li>실습 과제 중 가장 쉬운 항목 하나를 직접 수정합니다.</li>
          <li>고급 문서 단계에서는 더미 데이터 OFF로 실제 Spring Boot·MySQL 흐름을 확인합니다.</li>
        </ol>
      </article>
    </section>
  );
};
