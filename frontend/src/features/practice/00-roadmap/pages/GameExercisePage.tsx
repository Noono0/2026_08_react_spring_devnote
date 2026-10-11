/**
 * ============================================================================
 * GameExercisePage.tsx — 게임 규칙 직접 만들어 보기 (/react/game-exercises/:exerciseId)
 * ============================================================================
 *
 * 게임에서 쓰는 규칙 함수 하나를 아래 편집기(Sandpack)에서 완성한다. 무엇을 배우는지·실제 코드가 어디 있는지는
 * gameExercises.ts의 데이터를 그대로 그리고, 편집기 상자는 학습 단계와 같은 PracticeSandboxSection을 쓴다.
 * 편집기는 iframe 안에서 따로 실행되므로 실제 게임에는 영향이 없다.
 *
 * 주소의 exerciseId는 사용자가 고쳐 칠 수 있는 값이라, 목록에 없으면 로드맵으로 돌려보낸다(LearningLevelPage와 같은 방법).
 */
import { Link, Navigate, useParams } from "react-router-dom";
import { PracticeSandboxSection } from "@/features/curriculum/components/PracticeSandboxSection";
import { findGameExerciseById } from "@/features/curriculum/data/gameExercises";
import { learningLevelRoutes } from "@/features/curriculum/data/learningGuides";

export const GameExercisePage = () => {
  const { exerciseId = "" } = useParams();
  const exercise = findGameExerciseById(exerciseId);
  if (!exercise) return <Navigate to="/react" replace />;

  return (
    <section className="learning-page">
      <div className="page-hero">
        <span className="page-kicker">React 연습 · 게임 규칙 · {exercise.level}</span>
        <h1>{exercise.title}</h1>
        <p>{exercise.description}</p>
      </div>

      <article className="learning-note-card">
        <h2>이 연습에서 배우는 것</h2>
        <ul>
          {exercise.learningPoints.map((point) => <li key={point}>{point}</li>)}
        </ul>
        <p>
          같은 규칙을 실제 {exercise.game} 게임에서 쓰는 코드:{" "}
          {exercise.relatedFiles.map((file, index) => (
            <span key={file}>{index > 0 ? ", " : null}<code>frontend/{file}</code></span>
          ))}
        </p>
        <p>
          완성한 규칙이 실제 게임에서 어떻게 움직이는지는 <Link to="/games/online">온라인 대전</Link>에서 볼 수 있습니다.
        </p>
      </article>

      <p><Link to={learningLevelRoutes[exercise.level]}>{exercise.level} 학습 과정으로 돌아가기</Link></p>

      <PracticeSandboxSection
        // key: 다른 연습으로 옮겨 가면 상자를 새로 만든다(StageSandboxSection과 같은 이유)
        key={exercise.exerciseId}
        sandboxId={exercise.exerciseId}
        heading={`${exercise.title} 직접 만들어 보기`}
        description="맨 위 주석의 '해 볼 것'대로 TODO 함수를 완성하면 채점표가 ✅로 바뀝니다"
      />
    </section>
  );
};
