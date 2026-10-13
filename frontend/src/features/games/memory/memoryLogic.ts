/**
 * memoryLogic.ts — 카드 짝 맞추기 게임 규칙 (화면과 분리한 순수 함수 + 리듀서)
 *
 * [규칙]
 *   1) 뒤집힌 카드 두 장을 고른다. 같은 그림이면 짝 맞춤(계속 앞면), 다르면 잠시 뒤 다시 뒷면.
 *   2) 두 장을 고를 때마다 시도 횟수(moves)가 1 늘어난다.
 *   3) 모든 짝을 맞추면 승리. 시도 횟수가 적을수록(같으면 시간이 짧을수록) 좋은 기록이다.
 *
 * [왜 리듀서(useReducer)인가]
 *   "카드를 누르면" 바뀌는 값이 여러 개다(뒤집힌 카드, 짝 맞춤, 시도 횟수, 게임 상태).
 *   useState 여러 개로 나누면 서로 맞지 않는 순간이 생기기 쉽다.
 *   리듀서는 (지금 상태, 일어난 일) → 다음 상태 를 한 함수에서 계산하므로 규칙이 한곳에 모이고, 화면 없이 테스트할 수 있다.
 *
 * ★ 리듀서는 순수 함수여야 한다(같은 입력 → 같은 출력, 바깥을 건드리지 않음).
 *   그래서 무작위 섞기는 리듀서 밖(createDeck)에서 하고, 섞은 결과를 RESTART 동작에 담아 넘긴다.
 *   "잠시 뒤 뒷면으로"의 타이머(setTimeout)도 리듀서가 아니라 화면 컴포넌트의 useEffect가 맡는다.
 */
import { shuffle, type RandomSource } from "@/features/games/shared/random";

export type MemoryDifficulty = "EASY" | "NORMAL" | "HARD";

export const memoryDifficulties: Record<MemoryDifficulty, { label: string; pairCount: number; columns: number }> = {
  EASY: { label: "쉬움 · 6쌍", pairCount: 6, columns: 4 },
  NORMAL: { label: "보통 · 8쌍", pairCount: 8, columns: 4 },
  HARD: { label: "어려움 · 12쌍", pairCount: 12, columns: 6 },
};

/** 카드 그림. 가장 어려운 단계의 짝 수(12)만큼 있어야 한다. */
export const MEMORY_SYMBOLS = ["🍎", "🍌", "🍇", "🍓", "🍒", "🍑", "🍍", "🥝", "🥥", "🍋", "🍉", "🫐"] as const;

/** 다른 그림 두 장을 보여 준 뒤 다시 뒷면으로 돌리기까지 기다리는 시간(ms) */
export const MISMATCH_REVEAL_MS = 800;

export interface MemoryCard {
  id: number; // 카드 자리 번호(0부터). 목록 key와 클릭 대상으로 쓴다.
  symbol: string;
  matched: boolean;
}

export type MemoryStatus = "READY" | "PLAYING" | "WON";

export interface MemoryState {
  difficulty: MemoryDifficulty;
  cards: MemoryCard[];
  /** 지금 앞면으로 보이는(아직 짝 맞추지 않은) 카드 id. 0~2개 */
  flippedIds: number[];
  moves: number;
  elapsedSeconds: number;
  status: MemoryStatus;
}

export type MemoryAction =
  | { type: "FLIP"; cardId: number }
  | { type: "HIDE_UNMATCHED" } // 틀린 두 장을 뒷면으로(화면의 타이머가 보낸다)
  | { type: "TICK" } // 1초 지남(화면의 setInterval이 보낸다)
  | { type: "RESTART"; difficulty: MemoryDifficulty; cards: MemoryCard[] };

/** 짝 수만큼 그림을 두 장씩 만들어 섞은 카드 묶음 */
export const createDeck = (pairCount: number, random: RandomSource): MemoryCard[] => {
  if (pairCount < 1 || pairCount > MEMORY_SYMBOLS.length) throw new Error(`짝 수는 1~${MEMORY_SYMBOLS.length} 사이여야 합니다.`);
  const symbols = MEMORY_SYMBOLS.slice(0, pairCount).flatMap((symbol) => [symbol, symbol]);
  return shuffle(symbols, random).map((symbol, index) => ({ id: index, symbol, matched: false }));
};

export const createMemoryState = (difficulty: MemoryDifficulty, cards: MemoryCard[]): MemoryState => ({
  difficulty,
  cards,
  flippedIds: [],
  moves: 0,
  elapsedSeconds: 0,
  status: "READY",
});

/** 카드가 지금 앞면인지(짝 맞춘 카드이거나 방금 뒤집은 카드) */
export const isCardFaceUp = (state: MemoryState, card: MemoryCard): boolean => card.matched || state.flippedIds.includes(card.id);

export const countMatchedPairs = (state: MemoryState): number => state.cards.filter((card) => card.matched).length / 2;

const flipCard = (state: MemoryState, cardId: number): MemoryState => {
  if (state.status === "WON") return state;
  const card = state.cards.find((candidate) => candidate.id === cardId);
  // 없는 카드, 이미 짝 맞춘 카드, 이미 앞면인 카드는 다시 누를 수 없다.
  if (!card || card.matched || state.flippedIds.includes(cardId)) return state;

  // 틀린 두 장이 아직 앞면인데 다른 카드를 누르면, 기다리지 않고 바로 두 장을 덮고 새 카드를 뒤집는다.
  const previouslyFlipped = state.flippedIds.length === 2 ? [] : state.flippedIds;
  const flippedIds = [...previouslyFlipped, cardId];
  if (flippedIds.length < 2) return { ...state, flippedIds, status: "PLAYING" };

  // 두 번째 카드: 시도 1회. 같은 그림이면 짝 맞춤으로 표시하고 뒤집힌 목록을 비운다.
  const [firstId, secondId] = flippedIds;
  const firstCard = state.cards.find((candidate) => candidate.id === firstId);
  const moves = state.moves + 1;
  if (!firstCard || firstCard.symbol !== card.symbol) return { ...state, flippedIds, moves, status: "PLAYING" };

  // 불변성: 배열을 직접 고치지 않고 map으로 새 카드 배열을 만든다.
  const cards = state.cards.map((candidate) => (candidate.id === firstId || candidate.id === secondId ? { ...candidate, matched: true } : candidate));
  const won = cards.every((candidate) => candidate.matched);
  return { ...state, cards, flippedIds: [], moves, status: won ? "WON" : "PLAYING" };
};

export const memoryReducer = (state: MemoryState, action: MemoryAction): MemoryState => {
  switch (action.type) {
    case "FLIP":
      return flipCard(state, action.cardId);
    case "HIDE_UNMATCHED":
      return state.flippedIds.length === 2 ? { ...state, flippedIds: [] } : state;
    case "TICK":
      return state.status === "PLAYING" ? { ...state, elapsedSeconds: state.elapsedSeconds + 1 } : state;
    case "RESTART":
      return createMemoryState(action.difficulty, action.cards);
  }
};

/** 최고 기록: 시도 횟수가 적을수록, 같으면 시간이 짧을수록 좋다. */
export interface MemoryRecord {
  moves: number;
  seconds: number;
}

export const isBetterMemoryRecord = (candidate: MemoryRecord, best: MemoryRecord | null): boolean =>
  best === null || candidate.moves < best.moves || (candidate.moves === best.moves && candidate.seconds < best.seconds);

/** 초 → "1:05" */
export const formatSeconds = (totalSeconds: number): string => `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
