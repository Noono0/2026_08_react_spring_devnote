import { Link } from "react-router-dom";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";
import { learningGuideList, type LearningGuide } from "@/features/curriculum/data/learningGuides";

const learningRouteMap: Record<string, string> = {
  fundamentals: "/react/fundamentals",
  todo: "/react/todos",
  contact: "/react/contacts",
  product: "/react/modal-products",
  search: "/react/search-autocomplete",
  board: "/react/general-board",
  gallery: "/react/gallery",
  comment: "/react/comments",
  reservation: "/react/reservations",
  task: "/react/tasks",
  inquiry: "/react/inquiries",
  category: "/react/categories",
  document: "/react/documents",
  admin: "/react/admin-users",
};

const getStageGroupLabel = (learningGuide: LearningGuide): string => {
  if (learningGuide.difficultyScore <= 3) return "기초·초급";
  if (learningGuide.difficultyScore < 8) return "중급";
  return "고급";
};

const roadmapLearningGuides = learningGuideList.filter((learningGuide) => learningGuide.stageNumber > 0 && learningGuide.stageNumber <= 14);

export const LearningRoadmapPage = () => (
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
      <article><strong>14개</strong><span>난이도별 React 실습 단계</span></article>
      <article><strong>8종</strong><span>인라인·모달·페이지·계층·트리 등 UI 패턴</span></article>
      <article><strong>ON/OFF</strong><span>실제 백엔드와 MSW 더미 전환</span></article>
      <article><strong>?</strong><span>모든 화면 학습 가이드 모달</span></article>
    </div>

    {(["기초·초급", "중급", "고급"] as const).map((stageGroupLabel) => (
      <section className="roadmap-stage-section" key={stageGroupLabel}>
        <div className="roadmap-section-heading">
          <h2>{stageGroupLabel}</h2>
          <p>{stageGroupLabel === "기초·초급" ? "React 상태와 가장 단순한 CRUD 흐름을 익힙니다." : stageGroupLabel === "중급" ? "화면 패턴과 데이터 구조, 업무 규칙을 다양하게 경험합니다." : "권한·트리·파일·백엔드·대량 처리를 연습합니다."}</p>
        </div>
        <div className="roadmap-grid">
          {roadmapLearningGuides.filter((learningGuide) => getStageGroupLabel(learningGuide) === stageGroupLabel).map((learningGuide) => (
            <article className="roadmap-card" key={learningGuide.guideId}>
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
              <Link className="primary-link" to={learningRouteMap[learningGuide.guideId] ?? "/react"}>단계 시작하기</Link>
            </article>
          ))}
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
