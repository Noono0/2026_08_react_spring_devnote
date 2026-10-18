/**
 * DeadlineTimer.tsx — 서버가 보낸 마감 시각(epoch ms)까지 남은 초를 보여 주는 작은 배지(캐치마인드·사과게임 공용)
 *
 * ★ 1초마다 바뀌는 "지금 시각"을 이 작은 컴포넌트 안에만 둔다.
 *   큰 게임 화면에 두면 1초마다 화면 전체가 다시 렌더링된다. 자주 바뀌는 상태는 쓰는 곳 가까이에 둔다.
 * 화면 낭독기가 1초마다 읽지 않도록 aria-live 문단 밖에 두고 role="timer"로 표시한다.
 * 내 컴퓨터 시계가 서버와 많이 다르면 몇 초 어긋날 수 있다(실제 마감은 서버가 정한다).
 */
import { useEffect, useState } from "react";
import { secondsLeft } from "@/features/games/online/games/deadline";

export const DeadlineTimer = ({ deadline, urgentSeconds = 10 }: { deadline: number | null | undefined; urgentSeconds?: number }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline == null) return;
    const timerId = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timerId); // 정리: 차례가 바뀌거나 방을 나가면 타이머를 멈춘다
  }, [deadline]);
  const left = secondsLeft(deadline, now);
  if (left == null) return null;
  return <span className={`deadline-timer${left <= urgentSeconds ? " urgent" : ""}`} role="timer" aria-label={`남은 시간 ${left}초`}>⏱ {left}초</span>;
};
