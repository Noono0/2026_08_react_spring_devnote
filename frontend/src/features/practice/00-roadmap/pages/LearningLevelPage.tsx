/**
 * ============================================================================
 * LearningLevelPage.tsx — 난이도별 학습 목록 (/react/level/:level)
 * ============================================================================
 *
 * 하나의 컴포넌트가 URL의 값에 따라 네 가지 화면(왕초보/초급/중급/고급)을 그린다.
 *
 * [배울 개념]
 *   1. useParams로 URL의 값 꺼내기
 *   2. 잘못된 주소를 만났을 때 안전하게 처리하기
 *   3. 조건 판단 함수를 데이터에 담아 두기 (전략 패턴의 축소판)
 */

import { Link, Navigate, useParams } from "react-router-dom";
import { ADVANCED_TOPIC_FIRST_STAGE_NUMBER, learningStageRoutes, roadmapLearningGuides, type LearningGuide } from "@/features/curriculum/data/learningGuides";
import { LearningGuideTitle } from "@/features/curriculum/components/LearningGuideTitle";

/** 1~14단계(기본 CRUD 과정)인지 확인한다. 15단계부터는 난이도와 관계없이 "심화"에서 보여 준다. */
const isCoreStage = (guide: LearningGuide): boolean => guide.stageNumber < ADVANCED_TOPIC_FIRST_STAGE_NUMBER;

/**
 * 난이도 단계의 정의.
 *
 * ★ 눈여겨볼 점: `matches`가 "함수"다.
 *   보통 데이터에는 문자열이나 숫자만 담지만,
 *   JavaScript에서는 함수도 값이라 이렇게 담을 수 있다.
 *
 *   이렇게 하면 아래 컴포넌트에서 if문을 네 번 쓸 필요 없이
 *   `definition.matches(guide)` 한 줄로 끝난다.
 *   단계를 추가하고 싶으면 이 객체에 한 덩어리만 넣으면 된다.
 *   화면 코드는 손댈 필요가 없다.
 */
const levelDefinitions: Record<string, { title: string; description: string; matches: (guide: LearningGuide) => boolean }> = {
  beginner: { title: "왕초보", description: "React가 화면을 그리는 원리와 State·이벤트부터 시작합니다.", matches: (guide) => isCoreStage(guide) && guide.difficultyScore <= 1 },
  basic: { title: "초급", description: "배열 CRUD, Reducer, 폼과 모달을 익힙니다.", matches: (guide) => isCoreStage(guide) && guide.difficultyScore > 1 && guide.difficultyScore <= 4 },
  intermediate: { title: "중급", description: "Effect·비동기·게시판·계층 데이터와 업무 규칙을 다룹니다.", matches: (guide) => isCoreStage(guide) && guide.difficultyScore > 4 && guide.difficultyScore < 8 },
  advanced: { title: "고급", description: "권한·트리·파일·서버 상태·실제 백엔드를 연결합니다.", matches: (guide) => isCoreStage(guide) && guide.difficultyScore >= 8 },
  deep: { title: "심화", description: "무한 스크롤·동적 폼·Context·React 19·커스텀 훅·성능·전역 상태·URL 상태·포커스·Suspense·테스트를 다룹니다.", matches: (guide) => !isCoreStage(guide) },
};

export const LearningLevelPage = () => {
  // ★ useParams()로 주소에 들어 있는 값을 꺼낸다.
  //   App.tsx에 `path="level/:level"` 이라고 등록해 뒀으므로
  //   /react/level/beginner 로 들어오면 level = "beginner" 가 된다.
  //
  //   `= ""` 는 기본값이다. useParams가 돌려주는 값은 없을 수도 있어서
  //   (타입상 string | undefined) 기본값을 줘서 항상 문자열이 되게 한다.
  //
  //   ★ URL 값은 항상 문자열이다. 숫자 id라도 "3"처럼 문자열로 들어온다.
  const { level = "" } = useParams();

  const definition = levelDefinitions[level];

  // ★★ 주소 검증. 아주 중요한 습관이다.
  //   사용자가 /react/level/바나나 처럼 아무 주소나 칠 수 있다.
  //   그러면 definition이 undefined가 되고,
  //   아래에서 definition.title을 읽다가 앱이 통째로 죽는다.
  //
  //   그래서 못 찾으면 목록 페이지로 돌려보낸다.
  //   "URL은 사용자가 조작할 수 있는 입력값"이라고 생각하고 늘 검증하자.
  if (!definition) return <Navigate to="/react" replace />;

  // 이 난이도에 해당하는 학습 항목만 골라낸다.
  // definition.matches(guide) 부분에서 위에 담아 둔 판단 함수가 실행된다.
  const guides = roadmapLearningGuides.filter((guide) => definition.matches(guide));
  return (
    <section className="learning-page"><div className="page-hero"><span className="page-kicker">React Level</span><LearningGuideTitle guideId="roadmap">{definition.title} 학습 과정</LearningGuideTitle><p>{definition.description}</p></div><div className="roadmap-grid">{guides.map((guide) => <article className="roadmap-card" key={guide.guideId}><div className="roadmap-card-heading"><span className="roadmap-stage-number">{guide.stageNumber}</span><span className="difficulty-badge">난이도 {guide.difficultyScore}/10</span></div><h2>{guide.title}</h2><p>{guide.description}</p><ul className="topic-chip-list">{guide.learningTopics.slice(0, 5).map((topic) => <li key={topic}>{topic}</li>)}</ul><Link className="primary-link" to={learningStageRoutes[guide.guideId] ?? "/react"}>실습 시작</Link></article>)}</div></section>
  );
};
