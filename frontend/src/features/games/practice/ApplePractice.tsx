/**
 * ApplePractice.tsx — 사과게임 혼자 연습(방 대기 중)
 *
 * "시작"을 누르면 새 판과 2분 타이머가 시작된다. 사각형으로 합 10을 만들 때마다 사과가 사라지고 개수만큼 점수.
 * 시간이 끝나면 점수를 '연습 기록' 랭킹에 올릴 수 있다(GameRankingSubmitPanel). 규칙은 appleLogic.ts(브라우저 계산).
 *
 * [학습 포인트]
 *   - 남은 시간은 "마감 시각"만 상태로 들고, 지금 시각(now)을 0.25초마다 바꿔 계산한다.
 *     남은 초를 1씩 줄이는 방식보다 탭이 잠깐 멈추거나 타이머가 늦게 불려도 시간이 어긋나지 않는다.
 *   - 타이머는 진행 중일 때만 Effect로 만들고, 끝나거나 화면을 떠나면 정리(cleanup)한다.
 */
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  APPLE_TIME_LIMIT_SECONDS, applySelection, countApples, createAppleBoard, type AppleBoard, type CellRect,
} from "@/features/games/apple/appleLogic";
import { AppleBoardView } from "@/features/games/apple/AppleBoardView";
import { GameRankingSubmitPanel } from "@/features/games/ranking/components/GameRankingSubmitPanel";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";

const BEST_SCORE_KEY = "apple.best";
const bestScoreSchema = z.number().int().nonnegative();

type Phase = "READY" | "PLAYING" | "OVER";

export const ApplePractice = ({ nickname }: { nickname: string }) => {
  const [phase, setPhase] = useState<Phase>("READY");
  const [board, setBoard] = useState<AppleBoard>(() => createAppleBoard(Math.random));
  const [score, setScore] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [best, setBest] = useState(() => readGameRecord(BEST_SCORE_KEY, bestScoreSchema) ?? 0);

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));

  useEffect(() => {
    if (phase !== "PLAYING") return;
    const timerId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timerId);
  }, [phase]);

  // 시간이 다 되면 끝낸다. 최고 기록은 끝날 때 한 번만 저장한다
  useEffect(() => {
    if (phase !== "PLAYING" || secondsLeft > 0) return;
    setPhase("OVER");
    if (score > best) {
      setBest(score);
      writeGameRecord(BEST_SCORE_KEY, score);
    }
  }, [phase, secondsLeft, score, best]);

  const start = () => {
    const startedAt = Date.now();
    setBoard(createAppleBoard(Math.random));
    setScore(0);
    setNow(startedAt);
    setDeadline(startedAt + APPLE_TIME_LIMIT_SECONDS * 1000);
    setPhase("PLAYING");
  };

  const select = (rect: CellRect) => {
    if (phase !== "PLAYING") return;
    const result = applySelection(board, rect);
    if (result.removed === 0) return;
    setBoard(result.board);
    setScore((previous) => previous + result.removed);
  };

  return (
    <div className="apple-game apple-practice">
      <div className="apple-stats">
        <span>점수 <strong>{score}</strong></span>
        <span className={`apple-time${phase === "PLAYING" && secondsLeft <= 10 ? " urgent" : ""}`}>
          남은 시간 <strong>{phase === "PLAYING" ? secondsLeft : phase === "READY" ? APPLE_TIME_LIMIT_SECONDS : 0}</strong>초
        </span>
        <span>남은 사과 {countApples(board)}</span>
        <span>최고 {best}</span>
      </div>
      {phase === "PLAYING" ? (
        <AppleBoardView board={board} disabled={false} onSelect={select} />
      ) : (
        <div className="apple-ready">
          <p>{phase === "OVER" ? `끝! 사과 ${score}개를 없앴어요.` : `${APPLE_TIME_LIMIT_SECONDS / 60}분 동안 합이 10이 되도록 사과를 골라 없애세요.`}</p>
          <button type="button" onClick={start}>{phase === "OVER" ? "다시 하기" : "시작"}</button>
        </div>
      )}
      {phase === "OVER" ? (
        <GameRankingSubmitPanel gameCode="APPLE" record={{ score }} summary={`사과 ${score}개`} defaultNickname={nickname} />
      ) : null}
    </div>
  );
};
