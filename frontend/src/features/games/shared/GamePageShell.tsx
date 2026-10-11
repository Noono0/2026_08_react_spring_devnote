/**
 * GamePageShell.tsx — 게임 화면 네 개가 함께 쓰는 틀
 *
 * [화면 순서]
 *   제목·설명 → 게임 → "이 게임에서 배우는 것" → 직접 만들어 보기(Sandpack 편집기)
 *
 * 게임마다 다른 것은 제목·설명·배울 점·편집기 예제뿐이므로 props로 받고,
 * 게임 본체는 children으로 받아 가운데에 그린다(합성, composition).
 *
 * 게임 화면 스타일(games.css)은 여기서 import한다.
 * 게임 페이지는 lazy()로 따로 내려받으므로 이 CSS도 게임을 열 때만 내려받는다.
 */
import type { ReactNode } from "react";
import { PracticeSandboxSection } from "@/features/curriculum/components/PracticeSandboxSection";
import "@/features/games/shared/games.css";

interface GamePageShellProperties {
  kicker: string;
  title: string;
  description: string;
  /** 이 게임에서 배우는 React·알고리즘 포인트 */
  learningPoints: string[];
  /** 아래 "직접 만들어 보기" 편집기 */
  sandbox: { id: string; heading: string; description: string; source: string };
  children: ReactNode;
}

export const GamePageShell = ({ kicker, title, description, learningPoints, sandbox, children }: GamePageShellProperties) => (
  <section className="site-page game-page">
    <div className="page-hero">
      <span className="page-kicker">{kicker}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>

    {children}

    <section className="game-learning-points" aria-label="이 게임에서 배우는 것">
      <h2>이 게임에서 배우는 것</h2>
      <ul>
        {learningPoints.map((point) => <li key={point}>{point}</li>)}
      </ul>
      <p className="game-learning-source">규칙 코드: <code>frontend/src/features/games/</code> — 화면(Page)과 규칙(Logic)을 나눠 두어 규칙만 따로 테스트합니다.</p>
    </section>

    <PracticeSandboxSection sandboxId={sandbox.id} heading={sandbox.heading} description={sandbox.description} source={sandbox.source} />
  </section>
);

/** 점수·시간 같은 숫자 묶음. dl(용어-설명 목록)로 "이름: 값" 짝을 의미 있게 표시한다. */
export const GameStats = ({ items }: { items: { label: string; value: ReactNode }[] }) => (
  <dl className="game-stats">
    {items.map((item) => (
      <div key={item.label}>
        <dt>{item.label}</dt>
        <dd>{item.value}</dd>
      </div>
    ))}
  </dl>
);
