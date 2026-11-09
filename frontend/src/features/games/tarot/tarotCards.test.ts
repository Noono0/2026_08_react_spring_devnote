import { describe, expect, it } from "vitest";
import { createSeededRandom } from "@/features/games/shared/random";
import { drawTarotCards, majorArcana, meaningFor, summarizeTarot } from "@/features/games/tarot/tarotCards";

describe("타로 카드 뽑기", () => {
  it("22장의 서로 다른 카드를 유지하고 세 장을 중복 없이 뽑는다", () => {
    expect(majorArcana).toHaveLength(22);
    expect(new Set(majorArcana.map((card) => card.number)).size).toBe(22);
    const before = majorArcana.map((card) => card.number);
    const draws = drawTarotCards(3, createSeededRandom(42));
    expect(draws).toHaveLength(3);
    expect(new Set(draws.map(({ card }) => card.number)).size).toBe(3);
    expect(majorArcana.map((card) => card.number)).toEqual(before);
  });

  it("같은 난수라면 카드와 방향이 재현되고 방향별 해석이 달라진다", () => {
    const first = drawTarotCards(3, createSeededRandom(7));
    expect(drawTarotCards(3, createSeededRandom(7))).toEqual(first);
    const card = majorArcana[0];
    expect(card).toBeDefined();
    if (!card) return;
    expect(meaningFor({ card, reversed: false }).keyword).not.toBe(meaningFor({ card, reversed: true }).keyword);
    expect(summarizeTarot([{ card, reversed: false }])).toContain(card.upright.keyword);
    expect(summarizeTarot(first)).toContain("과거의 핵심");
  });
});
