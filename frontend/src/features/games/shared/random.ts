/**
 * random.ts — 게임에서 쓰는 "무작위" 도우미
 *
 * ★ 왜 Math.random을 바로 쓰지 않고 random 함수를 인자로 받을까?
 *   게임 규칙(카드 섞기, 지뢰 놓기, 다음 블록 고르기)을 테스트하려면 "매번 같은 무작위"가 필요하다.
 *   그래서 규칙 함수는 random을 인자로 받고,
 *     - 실제 게임: Math.random
 *     - 테스트·예제: createSeededRandom(시드) — 같은 시드면 언제나 같은 숫자 순서
 *   를 넘긴다. 이렇게 바깥에서 넘겨받는 것을 "의존성 주입"이라고 한다.
 */

/** 0 이상 1 미만의 수를 돌려주는 함수. Math.random과 같은 모양이다. */
export type RandomSource = () => number;

/**
 * 시드(seed)로 시작하는 재현 가능한 난수(mulberry32 알고리즘).
 * 같은 시드를 넣으면 언제나 같은 순서의 숫자가 나온다 → 테스트가 매번 같은 결과를 확인할 수 있다.
 */
export const createSeededRandom = (seed: number): RandomSource => {
  let state = seed >>> 0;
  return () => {
    const step = stepSeededRandom(state);
    state = step.nextState;
    return step.value;
  };
};

/**
 * 난수 한 걸음: 지금 상태 → (난수, 다음 상태). 바깥 변수를 바꾸지 않는 순수 함수다.
 * 리듀서처럼 순수해야 하는 곳(테트리스의 다음 블록 고르기)은 "난수 상태"를 게임 상태에 넣어 두고 이 함수로 한 걸음씩 나아간다.
 */
export const stepSeededRandom = (state: number): { value: number; nextState: number } => {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4294967296, nextState };
};

/** 0 이상 maxExclusive 미만의 정수 하나 */
export const randomInt = (maxExclusive: number, random: RandomSource): number => Math.floor(random() * maxExclusive);

/**
 * 피셔–예이츠(Fisher–Yates) 섞기. 모든 순서가 같은 확률로 나오는 표준 방법이다.
 * 원본 배열은 건드리지 않고(불변성) 섞은 새 배열을 돌려준다.
 *   ✗ items.sort(() => Math.random() - 0.5) 는 특정 순서가 더 자주 나오는 잘못된 섞기다.
 */
export const shuffle = <Item>(items: readonly Item[], random: RandomSource): Item[] => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1, random);
    const current = shuffled[index];
    const target = shuffled[swapIndex];
    if (current === undefined || target === undefined) continue; // 범위 안이라 일어나지 않지만 타입을 좁힌다
    shuffled[index] = target;
    shuffled[swapIndex] = current;
  }
  return shuffled;
};
