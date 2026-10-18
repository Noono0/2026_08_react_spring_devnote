/**
 * SuikaPractice.tsx — 수박게임 혼자 연습(방 대기 중)
 *
 * 판(SuikaBoard)이 물리와 조작을 맡고, 이 화면은 최고 점수 기억·다시 하기·랭킹 올리기만 한다.
 * [다시 하기] 판의 key를 바꾸면 React가 판을 새로 만든다 → 판 안의 상태(과일·점수·타이머)가 저절로 처음으로 돌아간다.
 *   reset 함수를 판에 따로 만들지 않아도 되는 React다운 방법이다.
 */
import { useState } from "react";
import { z } from "zod";
import { GameRankingSubmitPanel } from "@/features/games/ranking/components/GameRankingSubmitPanel";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import { SuikaBoard } from "@/features/games/suika/SuikaBoard";

const BEST_SCORE_KEY = "suika.best";
const bestScoreSchema = z.number().int().nonnegative();

export const SuikaPractice = ({ nickname }: { nickname: string }) => {
  const [round, setRound] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [best, setBest] = useState(() => readGameRecord(BEST_SCORE_KEY, bestScoreSchema) ?? 0);

  const handleGameOver = (score: number) => {
    setFinalScore(score);
    if (score > best) {
      setBest(score);
      writeGameRecord(BEST_SCORE_KEY, score);
    }
  };

  const restart = () => {
    setFinalScore(null);
    setRound((value) => value + 1);
  };

  return (
    <div className="suika-game suika-practice">
      <p className="online-hint">같은 과일 두 개가 닿으면 한 단계 큰 과일이 됩니다. 과일이 빨간 선 위에 1.5초 넘게 있으면 끝! 최고 {best}점</p>
      <SuikaBoard key={round} random={Math.random} onGameOver={handleGameOver} />
      {finalScore !== null ? (
        <>
          <p className="game-status" role="status">끝! {finalScore}점</p>
          <button type="button" onClick={restart}>다시 하기</button>
          <GameRankingSubmitPanel gameCode="SUIKA" record={{ score: finalScore }} summary={`${finalScore}점`} defaultNickname={nickname} />
        </>
      ) : null}
    </div>
  );
};
