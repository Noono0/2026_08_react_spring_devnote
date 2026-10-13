/**
 * 게임 규칙 직접 만들어 보기(초급) — 카드 짝 맞추기의 카드 섞기(피셔–예이츠)
 *
 * 해 볼 것
 *  1. 아래 shuffle 함수를 완성하세요. 지금은 섞지 않고 복사만 해서 돌려줍니다.
 *     - 원본 배열은 건드리지 말고 복사본을 섞습니다(불변성).
 *     - 뒤에서부터 i = 길이-1 … 1 까지, 0 ~ i 중 하나(j)를 골라 i번과 j번 자리를 바꿉니다.
 *       j = Math.floor(random() * (i + 1))
 *  2. 채점표가 모두 ✅가 되면 아래 카드판에서 짝 맞추기를 해 보세요(새 게임마다 섞입니다).
 *  3. (도전) 시도 횟수 State를 추가해 보세요. 두 번째 카드를 뒤집을 때 1씩 늘립니다.
 *
 *  ✗ items.sort(() => Math.random() - 0.5) 는 특정 순서가 더 자주 나오는 잘못된 섞기입니다(채점표의 "고르게 섞기"에서 걸립니다).
 */
import { useEffect, useState } from "react";

// ── TODO: 여기를 완성하세요 ─────────────────────────────────────
function shuffle<Item>(items: Item[], random: () => number = Math.random): Item[] {
  const copied = [...items];
  void random; // 완성하면 이 줄은 지워도 됩니다(random을 아직 쓰지 않아 남겨 둔 줄)
  return copied;
}
// ────────────────────────────────────────────────────────────────

/** 같은 시드면 같은 난수 순서(채점용) */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

function runChecks(): Check[] {
  try {
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const snapshot = [...original];
    const result = shuffle(original, seededRandom(7));
    // 세 가지 순서(0,1,2)를 12000번 섞어 6가지 순서가 각각 약 2000번씩 나오는지 센다
    const counts = new Map<string, number>();
    const random = seededRandom(42);
    for (let count = 0; count < 12000; count += 1) {
      const key = shuffle([0, 1, 2], random).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const even = counts.size === 6 && [...counts.values()].every((value) => Math.abs(value - 2000) < 150);
    return [
      { name: "원본 배열을 바꾸지 않는다", pass: original.join() === snapshot.join() },
      { name: "새 배열을 돌려준다", pass: result !== original },
      { name: "카드 개수와 종류가 그대로다", pass: [...result].sort((a, b) => a - b).join() === snapshot.join() },
      { name: "순서가 바뀐다", pass: result.join() !== snapshot.join() },
      { name: "6가지 순서가 고르게 나온다", pass: even, detail: [...counts.entries()].map(([key, value]) => `${key}:${value}`).join(" ") },
    ];
  } catch (error) {
    return [{ name: "shuffle 실행 중 오류", pass: false, detail: String(error) }];
  }
}

const SYMBOLS = ["🍎", "🍌", "🍇", "🍓", "🍒", "🍑"];

interface Card {
  id: number;
  symbol: string;
}

const newDeck = (): Card[] => shuffle(SYMBOLS.flatMap((symbol) => [symbol, symbol])).map((symbol, id) => ({ id, symbol }));

export default function App() {
  const checks = runChecks();
  const [cards, setCards] = useState(newDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);

  // 틀린 두 장은 0.8초 뒤에 덮는다. 다른 카드를 먼저 누르면 예약을 취소한다(cleanup)
  useEffect(() => {
    if (flipped.length !== 2) return;
    const timeoutId = setTimeout(() => setFlipped([]), 800);
    return () => clearTimeout(timeoutId);
  }, [flipped]);

  const flip = (card: Card) => {
    if (matched.includes(card.id) || flipped.includes(card.id)) return;
    const next = flipped.length === 2 ? [card.id] : [...flipped, card.id];
    if (next.length === 2) {
      const [first] = next;
      const firstCard = cards.find((candidate) => candidate.id === first);
      if (firstCard && firstCard.symbol === card.symbol) {
        setMatched((previous) => [...previous, firstCard.id, card.id]);
        setFlipped([]);
        return;
      }
    }
    setFlipped(next);
  };

  const restart = () => {
    setCards(newDeck());
    setFlipped([]);
    setMatched([]);
  };

  return (
    <main>
      <h1>카드 섞기 채점표</h1>
      <ul>
        {checks.map((check) => (
          <li key={check.name}>
            {check.pass ? "✅" : "❌"} {check.name}
            {check.detail ? <small> — {check.detail}</small> : null}
          </li>
        ))}
      </ul>

      <h2>카드판 {matched.length === cards.length ? "🎉 완성!" : `(${matched.length / 2} / ${SYMBOLS.length}쌍)`}</h2>
      <button onClick={restart}>새 게임(다시 섞기)</button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 64px)", gap: 8, marginTop: 12 }}>
        {cards.map((card) => {
          const faceUp = matched.includes(card.id) || flipped.includes(card.id);
          return (
            <button key={card.id} onClick={() => flip(card)} style={{ height: 64, fontSize: 28, opacity: matched.includes(card.id) ? 0.5 : 1 }}>
              {faceUp ? card.symbol : "?"}
            </button>
          );
        })}
      </div>
    </main>
  );
}
