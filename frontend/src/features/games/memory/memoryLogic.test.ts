import { describe, expect, it } from "vitest";
import { createSeededRandom } from "@/features/games/shared/random";
import {
  countMatchedPairs,
  createDeck,
  createMemoryState,
  formatSeconds,
  isBetterMemoryRecord,
  isCardFaceUp,
  memoryReducer,
  type MemoryCard,
  type MemoryState,
} from "./memoryLogic";

/** 섞지 않은 고정 카드: 0·1번이 🍎 짝, 2·3번이 🍌 짝 */
const fixedCards: MemoryCard[] = [
  { id: 0, symbol: "🍎", matched: false },
  { id: 1, symbol: "🍎", matched: false },
  { id: 2, symbol: "🍌", matched: false },
  { id: 3, symbol: "🍌", matched: false },
];
const start = (): MemoryState => createMemoryState("EASY", fixedCards);
const flip = (state: MemoryState, ...cardIds: number[]): MemoryState =>
  cardIds.reduce((current, cardId) => memoryReducer(current, { type: "FLIP", cardId }), state);

describe("카드 묶음 만들기", () => {
  it("짝 수만큼 그림이 정확히 두 장씩 있고, id는 0부터 자리 순서다", () => {
    const deck = createDeck(8, createSeededRandom(1));
    expect(deck).toHaveLength(16);
    expect(deck.map((card) => card.id)).toEqual(Array.from({ length: 16 }, (_, index) => index));
    const counts = new Map<string, number>();
    deck.forEach((card) => counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1));
    expect([...counts.values()]).toEqual(Array.from({ length: 8 }, () => 2));
    expect(deck.every((card) => !card.matched)).toBe(true);
  });

  it("같은 시드면 같은 순서, 다른 시드면 (대개) 다른 순서", () => {
    const symbolsOf = (seed: number) => createDeck(12, createSeededRandom(seed)).map((card) => card.symbol).join("");
    expect(symbolsOf(7)).toBe(symbolsOf(7));
    expect(symbolsOf(7)).not.toBe(symbolsOf(8));
  });

  it("짝 수가 범위를 벗어나면 오류", () => {
    expect(() => createDeck(0, Math.random)).toThrow();
    expect(() => createDeck(13, Math.random)).toThrow();
  });
});

describe("카드 뒤집기 규칙", () => {
  it("첫 카드를 누르면 게임이 시작되고 앞면이 된다(시도 횟수는 아직 그대로)", () => {
    const state = flip(start(), 0);
    expect(state.status).toBe("PLAYING");
    expect(state.flippedIds).toEqual([0]);
    expect(state.moves).toBe(0);
    expect(state.cards.filter((card) => isCardFaceUp(state, card)).map((card) => card.id)).toEqual([0]);
  });

  it("같은 그림 두 장이면 짝 맞춤, 시도 1회, 뒤집힌 목록은 비운다", () => {
    const state = flip(start(), 0, 1);
    expect(state.cards.filter((card) => card.matched).map((card) => card.id)).toEqual([0, 1]);
    expect(state.flippedIds).toEqual([]);
    expect(state.moves).toBe(1);
    expect(countMatchedPairs(state)).toBe(1);
  });

  it("다른 그림 두 장이면 둘 다 앞면으로 남아 있다가 HIDE_UNMATCHED로 뒷면이 된다", () => {
    const shown = flip(start(), 0, 2);
    expect(shown.flippedIds).toEqual([0, 2]);
    expect(shown.moves).toBe(1);
    expect(shown.cards.some((card) => card.matched)).toBe(false);
    const hidden = memoryReducer(shown, { type: "HIDE_UNMATCHED" });
    expect(hidden.flippedIds).toEqual([]);
  });

  it("틀린 두 장이 보이는 중에 다른 카드를 누르면 바로 덮고 새 카드만 앞면", () => {
    const state = flip(start(), 0, 2, 3);
    expect(state.flippedIds).toEqual([3]);
    expect(state.moves).toBe(1);
  });

  it("이미 앞면인 카드·짝 맞춘 카드·없는 카드는 눌러도 그대로(같은 객체)", () => {
    const one = flip(start(), 0);
    expect(memoryReducer(one, { type: "FLIP", cardId: 0 })).toBe(one);
    const matched = flip(start(), 0, 1);
    expect(memoryReducer(matched, { type: "FLIP", cardId: 1 })).toBe(matched);
    expect(memoryReducer(matched, { type: "FLIP", cardId: 99 })).toBe(matched);
  });

  it("모든 짝을 맞추면 승리하고, 승리 뒤에는 카드·시간이 바뀌지 않는다", () => {
    const won = flip(start(), 0, 2, 1, 0, 1, 2, 3);
    expect(won.status).toBe("WON");
    expect(won.moves).toBe(3); // (0,2) 틀림 → (1,0) 맞춤 → (2,3) 맞춤
    expect(memoryReducer(won, { type: "FLIP", cardId: 0 })).toBe(won);
    expect(memoryReducer(won, { type: "TICK" })).toBe(won);
  });

  it("시간은 게임 중에만 흐른다", () => {
    expect(memoryReducer(start(), { type: "TICK" }).elapsedSeconds).toBe(0);
    expect(memoryReducer(flip(start(), 0), { type: "TICK" }).elapsedSeconds).toBe(1);
  });

  it("다시 시작하면 새 카드로 처음 상태가 된다", () => {
    const restarted = memoryReducer(flip(start(), 0, 1), { type: "RESTART", difficulty: "HARD", cards: createDeck(12, createSeededRandom(3)) });
    expect(restarted).toMatchObject({ difficulty: "HARD", moves: 0, elapsedSeconds: 0, status: "READY", flippedIds: [] });
    expect(restarted.cards).toHaveLength(24);
  });
});

describe("기록", () => {
  it("시도 횟수가 적을수록, 같으면 시간이 짧을수록 더 좋은 기록", () => {
    expect(isBetterMemoryRecord({ moves: 10, seconds: 50 }, null)).toBe(true);
    expect(isBetterMemoryRecord({ moves: 9, seconds: 99 }, { moves: 10, seconds: 10 })).toBe(true);
    expect(isBetterMemoryRecord({ moves: 10, seconds: 40 }, { moves: 10, seconds: 50 })).toBe(true);
    expect(isBetterMemoryRecord({ moves: 10, seconds: 50 }, { moves: 10, seconds: 50 })).toBe(false);
    expect(isBetterMemoryRecord({ moves: 11, seconds: 1 }, { moves: 10, seconds: 50 })).toBe(false);
  });

  it("초를 분:초로", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(65)).toBe("1:05");
  });
});
