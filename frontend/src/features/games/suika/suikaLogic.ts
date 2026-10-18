/**
 * ============================================================================
 * suikaLogic.ts — 수박게임 규칙과 물리(순수 함수, 브라우저 계산)
 * ============================================================================
 *
 * [규칙] 위에서 과일을 떨어뜨린다. 같은 과일 두 개가 닿으면 합쳐져 한 단계 큰 과일이 된다.
 *   체리 → 딸기 → 포도 → 한라봉 → 감 → 사과 → 배 → 복숭아 → 파인애플 → 멜론 → 수박. 수박 둘이 만나면 사라진다.
 *   합칠 때 새 과일 단계에 따라 점수(1, 3, 6, 10, …)를 얻는다. 과일이 위쪽 선을 1.5초 넘게 넘어 있으면 끝.
 *
 * [물리 — 학습용으로 단순화] 원 모양 과일, 1/120초 간격:
 *   1) 중력으로 아래로 가속  2) 벽·바닥 밖으로 나가면 안으로 되돌리고 튕김을 줄임
 *   3) 겹친 두 과일을 무게(넓이) 비율로 밀어내고 속도를 주고받음(반발 0.15)  4) 같은 과일이 닿아 있으면 합치기
 *
 * [불변성] stepWorld는 받은 world를 바꾸지 않고 새 world를 돌려준다(React 상태에 그대로 넣는다).
 * [무작위] 다음 과일은 randomLevel(random)로 고른다. 온라인 대전은 서버가 준 시드로 모두 같은 순서를 받는다.
 */

export const BOX_WIDTH = 420;
export const BOX_HEIGHT = 600;
/** 이 선(위에서 거리) 위로 과일이 넘어가 있으면 위험 */
export const DANGER_LINE_Y = 90;
/** 떨어뜨리는 높이 */
export const DROP_Y = 45;
const GRAVITY = 1500;
const RESTITUTION = 0.15;
const WALL_BOUNCE = 0.2;
const STEP = 1 / 120;
const OVER_LINE_LIMIT_MS = 1500;
/** 떨어뜨린 직후에는 선 위에 있는 것이 당연하므로 이 시간 동안은 위험으로 세지 않는다 */
const DROP_GRACE_MS = 1200;

export interface FruitKind {
  name: string;
  emoji: string;
  radius: number;
  color: string;
}

/** 단계 0~10. 반지름은 상자 폭 420 기준 */
export const FRUITS: FruitKind[] = [
  { name: "체리", emoji: "🍒", radius: 14, color: "#e03131" },
  { name: "딸기", emoji: "🍓", radius: 19, color: "#f03e3e" },
  { name: "포도", emoji: "🍇", radius: 25, color: "#7048e8" },
  { name: "한라봉", emoji: "🍊", radius: 30, color: "#fd7e14" },
  { name: "감", emoji: "🟠", radius: 37, color: "#f76707" },
  { name: "사과", emoji: "🍎", radius: 46, color: "#c92a2a" },
  { name: "배", emoji: "🍐", radius: 53, color: "#c0eb75" },
  { name: "복숭아", emoji: "🍑", radius: 61, color: "#ffa8a8" },
  { name: "파인애플", emoji: "🍍", radius: 71, color: "#fcc419" },
  { name: "멜론", emoji: "🍈", radius: 82, color: "#94d82d" },
  { name: "수박", emoji: "🍉", radius: 96, color: "#2b8a3e" },
];
export const WATERMELON_LEVEL = FRUITS.length - 1;
/** 떨어뜨릴 수 있는 과일은 앞의 다섯 단계(체리~감) */
export const DROPPABLE_LEVELS = 5;
/** 합쳐서 만든 단계마다 얻는 점수(삼각수). 수박 둘이 사라질 때는 마지막 값 + 수박 점수 */
export const MERGE_SCORES = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];

export interface Fruit {
  id: number;
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 떨어뜨린 뒤 지난 시간(ms). DROP_GRACE_MS 동안은 위험선 검사에서 뺀다 */
  ageMs: number;
  /** 위험선 위에 연속으로 있던 시간(ms) */
  overLineMs: number;
}

export interface SuikaWorld {
  fruits: Fruit[];
  score: number;
  nextId: number;
  over: boolean;
  /** 이번에 합쳐진 횟수(소리·효과용, 화면이 읽고 무시해도 된다) */
  merges: number;
}

export const createWorld = (): SuikaWorld => ({ fruits: [], score: 0, nextId: 1, over: false, merges: 0 });

export const randomLevel = (random: () => number) => Math.floor(random() * DROPPABLE_LEVELS);

/** 떨어뜨릴 x를 상자 안(반지름만큼 안쪽)으로 맞춘다 */
export const clampDropX = (level: number, x: number) => {
  const radius = FRUITS[level]?.radius ?? 14;
  return Math.min(BOX_WIDTH - radius, Math.max(radius, x));
};

export const dropFruit = (world: SuikaWorld, level: number, x: number): SuikaWorld => {
  if (world.over) return world;
  const fruit: Fruit = { id: world.nextId, level, x: clampDropX(level, x), y: DROP_Y, vx: 0, vy: 0, ageMs: 0, overLineMs: 0 };
  return { ...world, fruits: [...world.fruits, fruit], nextId: world.nextId + 1 };
};

/** dtSeconds만큼 시간을 흘린다(1/120초씩 나눠 계산). 끝난 판은 그대로 */
export const stepWorld = (world: SuikaWorld, dtSeconds: number): SuikaWorld => {
  if (world.over) return world;
  let fruits = world.fruits.map((fruit) => ({ ...fruit }));
  let score = world.score;
  let nextId = world.nextId;
  let merges = 0;
  const steps = Math.max(1, Math.round(Math.min(dtSeconds, 0.1) / STEP));
  for (let step = 0; step < steps; step++) {
    // 1) 중력과 이동
    for (const fruit of fruits) {
      fruit.vy += GRAVITY * STEP;
      fruit.vx *= 0.999;
      fruit.x += fruit.vx * STEP;
      fruit.y += fruit.vy * STEP;
      fruit.ageMs += STEP * 1000;
    }
    // 3) 과일끼리 밀어내기(여러 번 돌면 쌓인 과일이 덜 파고든다)
    for (let pass = 0; pass < 3; pass++) separate(fruits);
    // 2) 벽·바닥
    for (const fruit of fruits) keepInBox(fruit);
    // 4) 합치기
    const merged = mergeTouching(fruits, nextId);
    fruits = merged.fruits;
    nextId = merged.nextId;
    score += merged.score;
    merges += merged.count;
  }
  const danger = updateDanger(fruits, steps * STEP * 1000);
  return { fruits: danger.fruits, score, nextId, over: danger.over, merges };
};

/**
 * 위험선 검사: 떨어뜨린 지 조금 지난 과일의 윗부분이 선 위에 있으면 그 시간을 더하고, 1.5초가 넘으면 끝(over).
 * 선 아래로 내려오면 시간은 다시 0. 새 배열을 돌려준다.
 */
export const updateDanger = (fruits: Fruit[], elapsedMs: number): { fruits: Fruit[]; over: boolean } => {
  let over = false;
  const next = fruits.map((fruit) => {
    const radius = FRUITS[fruit.level]?.radius ?? 14;
    const aboveLine = fruit.ageMs > DROP_GRACE_MS && fruit.y - radius < DANGER_LINE_Y;
    const overLineMs = aboveLine ? fruit.overLineMs + elapsedMs : 0;
    if (overLineMs >= OVER_LINE_LIMIT_MS) over = true;
    return { ...fruit, overLineMs };
  });
  return { fruits: next, over };
};

const keepInBox = (fruit: Fruit) => {
  const radius = FRUITS[fruit.level]?.radius ?? 14;
  if (fruit.x < radius) {
    fruit.x = radius;
    fruit.vx = Math.abs(fruit.vx) * WALL_BOUNCE;
  } else if (fruit.x > BOX_WIDTH - radius) {
    fruit.x = BOX_WIDTH - radius;
    fruit.vx = -Math.abs(fruit.vx) * WALL_BOUNCE;
  }
  if (fruit.y > BOX_HEIGHT - radius) {
    fruit.y = BOX_HEIGHT - radius;
    fruit.vy = -Math.abs(fruit.vy) * WALL_BOUNCE;
    fruit.vx *= 0.98; // 바닥 마찰
  }
};

const separate = (fruits: Fruit[]) => {
  for (let first = 0; first < fruits.length; first++) {
    const a = fruits[first];
    if (!a) continue;
    for (let second = first + 1; second < fruits.length; second++) {
      const b = fruits[second];
      if (!b) continue;
      const ra = FRUITS[a.level]?.radius ?? 14;
      const rb = FRUITS[b.level]?.radius ?? 14;
      // 정확히 위아래로 겹치면 완벽한 탑처럼 균형을 잡아 버린다.
      // 실제 과일처럼 굴러떨어지도록 id 짝홀에 따라 아주 조금 옆으로 기울인다(무작위가 아니라 늘 같은 결과).
      const rawDx = b.x - a.x;
      const dx = Math.abs(rawDx) < 0.5 ? rawDx + (b.id % 2 === 0 ? 0.5 : -0.5) : rawDx;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = ra + rb;
      if (distance >= minDistance) continue;
      // 정확히 같은 자리면 살짝 옆으로 비켜 방향을 만든다
      const nx = distance > 1e-6 ? dx / distance : 1;
      const ny = distance > 1e-6 ? dy / distance : 0;
      const massA = ra * ra;
      const massB = rb * rb;
      const overlap = minDistance - distance;
      const shareA = massB / (massA + massB);
      const shareB = massA / (massA + massB);
      a.x -= nx * overlap * shareA;
      a.y -= ny * overlap * shareA;
      b.x += nx * overlap * shareB;
      b.y += ny * overlap * shareB;
      const approaching = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (approaching <= 0) continue;
      const impulse = ((1 + RESTITUTION) * approaching) / (1 / massA + 1 / massB);
      a.vx -= (impulse / massA) * nx;
      a.vy -= (impulse / massA) * ny;
      b.vx += (impulse / massB) * nx;
      b.vy += (impulse / massB) * ny;
    }
  }
};

/** 닿아 있는 같은 과일 쌍을 한 단계 큰 과일 하나로(한 번에 한 과일은 한 번만 합친다) */
const mergeTouching = (fruits: Fruit[], startId: number) => {
  const used = new Set<number>();
  const created: Fruit[] = [];
  let nextId = startId;
  let score = 0;
  let count = 0;
  for (let first = 0; first < fruits.length; first++) {
    const a = fruits[first];
    if (!a || used.has(a.id)) continue;
    for (let second = first + 1; second < fruits.length; second++) {
      const b = fruits[second];
      if (!b || used.has(b.id) || b.level !== a.level) continue;
      const radius = FRUITS[a.level]?.radius ?? 14;
      if (Math.hypot(b.x - a.x, b.y - a.y) > radius * 2 + 1) continue; // 1만큼 여유: 밀어낸 직후 딱 붙은 것도 닿은 것으로
      used.add(a.id);
      used.add(b.id);
      count++;
      if (a.level === WATERMELON_LEVEL) {
        score += (MERGE_SCORES[WATERMELON_LEVEL] ?? 66) * 2; // 수박 둘 = 사라지며 큰 점수
        break;
      }
      const level = a.level + 1;
      score += MERGE_SCORES[level] ?? 0;
      created.push({
        id: nextId++, level, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: (a.vx + b.vx) / 2, vy: (a.vy + b.vy) / 2,
        ageMs: Math.max(a.ageMs, b.ageMs), overLineMs: 0,
      });
      break;
    }
  }
  if (count === 0) return { fruits, nextId, score, count };
  return { fruits: [...fruits.filter((fruit) => !used.has(fruit.id)), ...created], nextId, score, count };
};

/** 모든 과일이 거의 멈췄는지(테스트·연출용) */
export const isSettled = (world: SuikaWorld) => world.fruits.every((fruit) => Math.hypot(fruit.vx, fruit.vy) < 5);
