import { Link, Navigate, useParams } from "react-router-dom";
import { learningGuideList, type LearningGuide } from "@/features/learning/data/learningGuides";

const routeMap: Record<string, string> = { fundamentals: "/react/fundamentals", todo: "/react/todos", contact: "/react/contacts", product: "/react/modal-products", search: "/react/search-autocomplete", board: "/react/general-board", gallery: "/react/gallery", comment: "/react/comments", reservation: "/react/reservations", task: "/react/tasks", inquiry: "/react/inquiries", category: "/react/categories", document: "/react/documents", admin: "/react/admin-users" };
const levelDefinitions: Record<string, { title: string; description: string; matches: (guide: LearningGuide) => boolean }> = {
  beginner: { title: "왕초보", description: "React가 화면을 그리는 원리와 State·이벤트부터 시작합니다.", matches: (guide) => guide.difficultyScore <= 1 },
  basic: { title: "초급", description: "배열 CRUD, Reducer, 폼과 모달을 익힙니다.", matches: (guide) => guide.difficultyScore > 1 && guide.difficultyScore <= 4 },
  intermediate: { title: "중급", description: "Effect·비동기·게시판·계층 데이터와 업무 규칙을 다룹니다.", matches: (guide) => guide.difficultyScore > 4 && guide.difficultyScore < 8 },
  advanced: { title: "고급", description: "권한·트리·파일·서버 상태·실제 백엔드를 연결합니다.", matches: (guide) => guide.difficultyScore >= 8 },
};

export const LearningLevelPage = () => {
  const { level = "" } = useParams();
  const definition = levelDefinitions[level];
  if (!definition) return <Navigate to="/react" replace />;
  const guides = learningGuideList.filter((guide) => guide.stageNumber > 0 && guide.stageNumber <= 14 && definition.matches(guide));
  return (
    <section className="learning-page"><div className="page-hero"><span className="page-kicker">React Level</span><h1>{definition.title} 학습 과정</h1><p>{definition.description}</p></div><div className="roadmap-grid">{guides.map((guide) => <article className="roadmap-card" key={guide.guideId}><div className="roadmap-card-heading"><span className="roadmap-stage-number">{guide.stageNumber}</span><span className="difficulty-badge">난이도 {guide.difficultyScore}/10</span></div><h2>{guide.title}</h2><p>{guide.description}</p><ul className="topic-chip-list">{guide.learningTopics.slice(0, 5).map((topic) => <li key={topic}>{topic}</li>)}</ul><Link className="primary-link" to={routeMap[guide.guideId] ?? "/react"}>실습 시작</Link></article>)}</div></section>
  );
};
