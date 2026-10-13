/**
 * MemoryPractice.tsx — 대기 중인 카드 짝 맞추기 대전 방에서 혼자 연습
 *
 * 게임 규칙(뒤집기·짝 확인·타이머)은 memoryLogic.ts의 리듀서에 있다.
 * 이 화면은 action을 보내고 결과 상태를 그리기만 한다. 서버와는 아무것도 주고받지 않는다.
 *
 * [시간과 관련된 일은 useEffect로]
 *   - 1초마다 TICK: setInterval. 게임 중일 때만 돌리고, 끝나거나 화면이 떠나면 cleanup에서 멈춘다.
 *   - 틀린 두 장 덮기: setTimeout. 두 장이 열려 있는 동안만 예약하고, 그 전에 다른 카드를 누르면 예약을 취소한다.
 *
 * [최고 기록 = 저장값 State + 그릴 때 계산 + Effect로 저장]
 *   이긴 판의 새 기록이면 localStorage에 쓴다. 이긴 뒤에는 시도·시간이 더 바뀌지 않으므로 한 번만 저장된다.
 */
import { useEffect, useReducer, useState } from "react";
import { z } from "zod";
import { GameRankingSubmitPanel } from "@/features/games/ranking/components/GameRankingSubmitPanel";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import { GameStats } from "@/features/games/shared/GameStats";
import {
  countMatchedPairs,
  createDeck,
  createMemoryState,
  formatSeconds,
  isBetterMemoryRecord,
  isCardFaceUp,
  memoryDifficulties,
  memoryReducer,
  MISMATCH_REVEAL_MS,
  type MemoryDifficulty,
  type MemoryRecord,
} from "@/features/games/memory/memoryLogic";

const RECORD_KEY = "memory.best";
const memoryRecordSchema = z.object({ moves: z.number().int().nonnegative(), seconds: z.number().int().nonnegative() });
const bestRecordsSchema = z.object({ EASY: memoryRecordSchema.optional(), NORMAL: memoryRecordSchema.optional(), HARD: memoryRecordSchema.optional() });
type BestRecords = z.infer<typeof bestRecordsSchema>;

const difficultyOrder: MemoryDifficulty[] = ["EASY", "NORMAL", "HARD"];

const createGame = (difficulty: MemoryDifficulty) => createMemoryState(difficulty, createDeck(memoryDifficulties[difficulty].pairCount, Math.random));

export const MemoryPractice = ({ nickname }: { nickname: string }) => {
  const [state, dispatch] = useReducer(memoryReducer, "NORMAL", createGame);
  const [storedRecords, setStoredRecords] = useState<BestRecords>(() => readGameRecord(RECORD_KEY, bestRecordsSchema) ?? {});

  const isPlaying = state.status === "PLAYING";
  useEffect(() => {
    if (!isPlaying) return;
    const timerId = window.setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => window.clearInterval(timerId);
  }, [isPlaying]);

  const isMismatchShown = state.flippedIds.length === 2;
  useEffect(() => {
    if (!isMismatchShown) return;
    const timeoutId = window.setTimeout(() => dispatch({ type: "HIDE_UNMATCHED" }), MISMATCH_REVEAL_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isMismatchShown]);

  const { difficulty, moves, elapsedSeconds } = state;
  const storedBest = storedRecords[difficulty] ?? null;
  const winRecord: MemoryRecord | null = state.status === "WON" ? { moves, seconds: elapsedSeconds } : null;
  const isNewRecord = winRecord !== null && isBetterMemoryRecord(winRecord, storedBest);
  const best = isNewRecord ? winRecord : storedBest;

  useEffect(() => {
    if (!isNewRecord) return;
    writeGameRecord(RECORD_KEY, { ...storedRecords, [difficulty]: { moves, seconds: elapsedSeconds } });
  }, [isNewRecord, storedRecords, difficulty, moves, elapsedSeconds]);

  const restart = (nextDifficulty: MemoryDifficulty) => {
    if (isNewRecord && winRecord) setStoredRecords({ ...storedRecords, [difficulty]: winRecord });
    dispatch({ type: "RESTART", difficulty: nextDifficulty, cards: createDeck(memoryDifficulties[nextDifficulty].pairCount, Math.random) });
  };

  const { pairCount, columns } = memoryDifficulties[difficulty];
  const statusMessage = state.status === "WON"
    ? `모두 맞췄습니다! ${state.moves}번 시도, ${formatSeconds(state.elapsedSeconds)}${isNewRecord ? " — 새 최고 기록!" : ""}`
    : state.status === "READY" ? "카드를 눌러 시작하세요. 같은 그림 두 장을 찾으면 짝이 맞습니다." : `${countMatchedPairs(state)} / ${pairCount}쌍 맞춤`;

  return (
    <div className="practice-game">
      <div className="game-toolbar">
        <div className="segmented-buttons" role="group" aria-label="난이도">
          {difficultyOrder.map((option) => (
            <button key={option} type="button" className={option === difficulty ? "active" : ""} aria-pressed={option === difficulty} onClick={() => restart(option)}>
              {memoryDifficulties[option].label}
            </button>
          ))}
        </div>
        <button type="button" className="ghost-button" onClick={() => restart(difficulty)}>새 게임</button>
      </div>

      <GameStats items={[
        { label: "시도", value: state.moves },
        { label: "맞춘 짝", value: `${countMatchedPairs(state)} / ${pairCount}` },
        { label: "시간", value: formatSeconds(state.elapsedSeconds) },
        { label: "최고 기록", value: best ? `${best.moves}번 · ${formatSeconds(best.seconds)}` : "없음" },
      ]} />

      <p className={`game-status${state.status === "WON" ? " success" : ""}`} aria-live="polite">{statusMessage}</p>

      {winRecord ? (
        <GameRankingSubmitPanel
          gameCode="MEMORY"
          difficulty={difficulty}
          record={{ moves: winRecord.moves, elapsedSeconds: winRecord.seconds }}
          summary={`${memoryDifficulties[difficulty].label} ${winRecord.moves}번 · ${formatSeconds(winRecord.seconds)}`}
          defaultNickname={nickname}
        />
      ) : null}

      <div className="memory-board" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, maxWidth: columns * 104 }} aria-label="카드판">
        {state.cards.map((card, index) => {
          const faceUp = isCardFaceUp(state, card);
          return (
            <button
              key={card.id}
              type="button"
              className={`memory-card${faceUp ? " face-up" : ""}${card.matched ? " matched" : ""}`}
              aria-label={faceUp ? `${index + 1}번 카드 ${card.symbol}${card.matched ? " (짝 맞춤)" : ""}` : `${index + 1}번 카드 (뒷면)`}
              disabled={card.matched || state.status === "WON"}
              onClick={() => dispatch({ type: "FLIP", cardId: card.id })}
            >
              <span className="memory-card-inner" aria-hidden="true">
                <span className="memory-card-back">?</span>
                <span className="memory-card-front">{card.symbol}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
