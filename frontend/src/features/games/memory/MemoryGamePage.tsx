/**
 * MemoryGamePage.tsx — 카드 짝 맞추기 화면
 *
 * [상태는 어디에?]
 *   게임 규칙(뒤집기·짝 확인·승리)은 memoryLogic.ts의 리듀서(memoryReducer)에 있다.
 *   이 화면은 (1) 리듀서에 "무슨 일이 일어났는지(action)"를 보내고 (2) 결과 상태를 그리기만 한다.
 *
 * [시간과 관련된 일은 useEffect로]
 *   - 1초마다 TICK: setInterval. 게임 중일 때만 돌리고, 끝나거나 화면을 떠나면 cleanup에서 멈춘다.
 *   - 틀린 두 장 덮기: setTimeout. 두 장이 열려 있는 동안만 예약하고, 그 전에 다른 카드를 누르면 예약을 취소한다.
 *
 * [최고 기록 = 저장값 State + 그릴 때 계산 + Effect로 저장]
 *   - storedRecords: 화면을 열 때 localStorage에서 읽은 기록(State)
 *   - 지금 판을 이겼다면 "새 최고 기록인가?"는 그릴 때마다 계산한다(따로 State를 두지 않는다)
 *   - localStorage에 쓰는 일(브라우저 저장소와 맞추기)은 useEffect가 한다
 *   - 새 게임을 시작할 때(이벤트) 이번 판의 새 기록을 storedRecords에 반영한다
 *   ★ 클릭 처리 함수에서 state로 "다음 상태"를 미리 계산해 저장하지 않는 이유:
 *     아주 빠르게 연달아 누르면 다시 그려지기 전의 옛 state(오래된 클로저)로 계산해 기록이 틀릴 수 있다.
 */
import { useEffect, useReducer, useState } from "react";
import { z } from "zod";
import { GamePageShell, GameStats } from "@/features/games/shared/GamePageShell";
import { readGameRecord, writeGameRecord } from "@/features/games/shared/gameRecordStorage";
import memorySandboxSource from "@/features/games/sandbox/examples/memory-shuffle.tsx?raw";
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
} from "./memoryLogic";

const RECORD_KEY = "memory.best";
const memoryRecordSchema = z.object({ moves: z.number().int().nonnegative(), seconds: z.number().int().nonnegative() });
// 난이도마다 따로 최고 기록을 둔다. 저장된 값이 이 모양이 아니면 기록이 없는 것으로 본다.
const bestRecordsSchema = z.object({ EASY: memoryRecordSchema.optional(), NORMAL: memoryRecordSchema.optional(), HARD: memoryRecordSchema.optional() });
type BestRecords = z.infer<typeof bestRecordsSchema>;

const difficultyOrder: MemoryDifficulty[] = ["EASY", "NORMAL", "HARD"];

/** 새 게임 상태: 난이도의 짝 수만큼 카드를 섞어 만든다(실제 게임은 Math.random) */
const createGame = (difficulty: MemoryDifficulty) => createMemoryState(difficulty, createDeck(memoryDifficulties[difficulty].pairCount, Math.random));

export const MemoryGamePage = () => {
  // useReducer의 세 번째 인자(초기화 함수): 처음 한 번만 카드를 섞는다. 화면을 다시 그릴 때마다 섞지 않는다.
  const [state, dispatch] = useReducer(memoryReducer, "NORMAL", createGame);
  const [storedRecords, setStoredRecords] = useState<BestRecords>(() => readGameRecord(RECORD_KEY, bestRecordsSchema) ?? {});

  const isPlaying = state.status === "PLAYING";
  useEffect(() => {
    if (!isPlaying) return;
    const timerId = window.setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => window.clearInterval(timerId); // 끝나거나 화면을 떠나면 반드시 멈춘다
  }, [isPlaying]);

  // 짝 맞춘 두 장은 리듀서가 바로 비우므로, 두 장이 열려 있다 = 틀린 두 장이다.
  const isMismatchShown = state.flippedIds.length === 2;
  useEffect(() => {
    if (!isMismatchShown) return;
    const timeoutId = window.setTimeout(() => dispatch({ type: "HIDE_UNMATCHED" }), MISMATCH_REVEAL_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isMismatchShown]);

  // 이긴 판의 기록과 저장된 기록을 비교한다(그릴 때마다 계산)
  const { difficulty, moves, elapsedSeconds } = state;
  const storedBest = storedRecords[difficulty] ?? null;
  const winRecord: MemoryRecord | null = state.status === "WON" ? { moves, seconds: elapsedSeconds } : null;
  const isNewRecord = winRecord !== null && isBetterMemoryRecord(winRecord, storedBest);
  const best = isNewRecord ? winRecord : storedBest;

  // 새 최고 기록이면 브라우저에 저장한다. 이긴 뒤에는 시도·시간이 더 바뀌지 않으므로 한 번만 저장된다.
  useEffect(() => {
    if (!isNewRecord) return;
    writeGameRecord(RECORD_KEY, { ...storedRecords, [difficulty]: { moves, seconds: elapsedSeconds } });
  }, [isNewRecord, storedRecords, difficulty, moves, elapsedSeconds]);

  const restart = (nextDifficulty: MemoryDifficulty) => {
    if (isNewRecord && winRecord) setStoredRecords({ ...storedRecords, [difficulty]: winRecord }); // 불변성: 새 객체
    dispatch({ type: "RESTART", difficulty: nextDifficulty, cards: createDeck(memoryDifficulties[nextDifficulty].pairCount, Math.random) });
  };

  const { pairCount, columns } = memoryDifficulties[difficulty];
  const statusMessage = state.status === "WON"
    ? `모두 맞췄습니다! ${state.moves}번 시도, ${formatSeconds(state.elapsedSeconds)}${isNewRecord ? " — 새 최고 기록!" : ""}`
    : state.status === "READY" ? "카드를 눌러 시작하세요. 같은 그림 두 장을 찾으면 짝이 맞습니다." : `${countMatchedPairs(state)} / ${pairCount}쌍 맞춤`;

  return (
    <GamePageShell
      kicker="Game · Memory"
      title="카드 짝 맞추기"
      description="뒤집힌 카드 두 장을 골라 같은 그림을 찾습니다. 적은 시도로 빨리 맞출수록 좋은 기록입니다."
      learningPoints={[
        "useReducer: 뒤집기·짝 확인·승리 규칙을 리듀서 하나에 모으고 화면은 action만 보냅니다.",
        "useEffect cleanup: 타이머(setInterval)와 틀린 카드 덮기(setTimeout)를 화면을 떠나면 반드시 정리합니다.",
        "피셔–예이츠 섞기: 모든 순서가 같은 확률로 나오는 섞기. 아래 편집기에서 직접 만들어 봅니다.",
        "localStorage + zod: 저장된 최고 기록은 믿을 수 없는 입력이라 모양을 확인한 뒤 씁니다.",
      ]}
      sandbox={{ id: "game-memory", heading: "카드 섞기 직접 만들어 보기", description: "shuffle 함수를 완성하면 채점표가 ✅로 바뀌고 카드판이 섞입니다", source: memorySandboxSource }}
    >
      <div className="game-panel">
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

        {/* aria-live: 내용이 바뀌면 화면 낭독기가 읽어 준다(짝 맞춤·승리 알림) */}
        <p className={`game-status${state.status === "WON" ? " success" : ""}`} aria-live="polite">{statusMessage}</p>

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
    </GamePageShell>
  );
};
