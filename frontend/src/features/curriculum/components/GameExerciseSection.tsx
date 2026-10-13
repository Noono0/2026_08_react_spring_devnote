/**
 * GameExerciseSection.tsx — "게임 규칙 직접 만들어 보기" 카드 묶음(전체 로드맵·난이도별 목록이 함께 쓴다)
 *
 * 학습 단계 카드와 같은 모양(roadmap-card)이지만 단계 번호·완료 표시 대신 게임 이름을 보여 준다.
 * 보여 줄 연습이 없으면(예: 심화) 아무것도 그리지 않는다.
 */
import { useId } from "react";
import { Link } from "react-router-dom";
import { gameExerciseRoute, type GameExercise } from "@/features/curriculum/data/gameExercises";

interface GameExerciseSectionProperties {
  exercises: GameExercise[];
  description: string;
}

export const GameExerciseSection = ({ exercises, description }: GameExerciseSectionProperties) => {
  const headingId = useId();
  if (exercises.length === 0) return null;

  return (
    <section className="roadmap-stage-section" aria-labelledby={headingId}>
      <div className="roadmap-section-heading">
        <h2 id={headingId}>게임 규칙 직접 만들어 보기</h2>
        <p>{description}</p>
      </div>
      <div className="roadmap-grid">
        {exercises.map((exercise) => (
          <article className="roadmap-card" key={exercise.exerciseId}>
            <div className="roadmap-card-heading">
              <span className="roadmap-stage-number" aria-hidden="true">🎮</span>
              <div className="roadmap-badge-row">
                <span className={`level-badge level-${exercise.level}`}>{exercise.level}</span>
                <span className="difficulty-badge">{exercise.game}</span>
              </div>
            </div>
            <h3>{exercise.title}</h3>
            <p>{exercise.description}</p>
            <ul className="topic-chip-list">
              {exercise.topics.map((topic) => <li key={topic}>{topic}</li>)}
            </ul>
            {/* 링크 이름에 연습 제목을 넣어, 링크만 훑어도 어느 연습인지 알 수 있게 한다 */}
            <Link className="primary-link" to={gameExerciseRoute(exercise)} aria-label={`${exercise.title} 연습 시작`}>연습 시작</Link>
          </article>
        ))}
      </div>
    </section>
  );
};
