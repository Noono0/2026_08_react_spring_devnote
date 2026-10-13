/**
 * GameStats.tsx — 점수·시간 같은 숫자 묶음(대기 중 혼자 연습 화면들이 함께 쓴다)
 *
 * dl(용어-설명 목록)로 "이름: 값" 짝을 의미 있게 표시한다. 화면 낭독기도 이름과 값을 짝지어 읽는다.
 */
import type { ReactNode } from "react";

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
