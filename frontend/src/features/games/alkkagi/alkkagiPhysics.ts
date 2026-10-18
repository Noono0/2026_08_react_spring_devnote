/**
 * ============================================================================
 * alkkagiPhysics.ts — 알까기 물리(혼자 연습용, 브라우저에서 계산)
 * ============================================================================
 *
 * 온라인 대전에서는 서버(AlkkagiGame.java)가 계산한 궤적을 모두가 재생한다.
 * 혼자 연습할 때는 서버가 없어도 되도록 같은 규칙을 브라우저에서 계산한다.
 *
 * ★ 규칙이 두 곳(Java·TypeScript)에 있게 되므로, 상수와 계산 순서를 서버와 똑같이 맞춘다.
 *   1/240초마다: 1) 마찰로 속력 줄이기 → 2) 겹친 알끼리 충돌 → 3) 판 밖으로 나간 알 떨어뜨리기
 *   서버 쪽을 바꾸면 이 파일도 함께 바꾸고, 같은 상황을 두 테스트(AlkkagiGameTest·alkkagiPhysics.test)로 확인한다.
 *
 * [불변성] 입력으로 받은 알 배열은 바꾸지 않고, 계산이 끝난 새 배열을 돌려준다(React 상태에 그대로 넣을 수 있다).
 */

export const BOARD_SIZE = 1000;
export const STONE_RADIUS = 24;
const MAX_SPEED = 2000;   // 힘 100일 때 처음 속력(판 단위/초)
const FRICTION = 900;     // 마찰 감속(판 단위/초²)
const RESTITUTION = 0.9;  // 충돌할 때 속도가 얼마나 남는지
const STEP = 1 / 240;
const STEPS_PER_FRAME = 8; // 240 ÷ 8 = 30프레임/초
const MAX_SECONDS = 12;

export interface PhysicsStone {
  side: number;
  x: number;
  y: number;
  alive: boolean;
}

export interface FlickResult {
  /** 다 멈춘 뒤의 알(새 배열) */
  stones: PhysicsStone[];
  /** 1/30초마다의 위치. frames[n] = [x0, y0, x1, y1, ...], 떨어진 알은 -1 (서버 Shot.frames와 같은 모양) */
  frames: number[][];
}

const snapshot = (stones: PhysicsStone[]): number[] =>
  stones.flatMap((stone) => (stone.alive ? [Math.round(stone.x), Math.round(stone.y)] : [-1, -1]));

/** stoneIndex 알을 angle(0 = 오른쪽, 90 = 위쪽)·power(5~100)로 튕긴 결과 */
export const simulateFlick = (input: PhysicsStone[], stoneIndex: number, angle: number, power: number): FlickResult => {
  // 계산 중에는 복사본을 바꾼다(입력 배열·객체는 그대로)
  const stones = input.map((stone) => ({ ...stone }));
  const vx = stones.map(() => 0);
  const vy = stones.map(() => 0);
  const speed = (MAX_SPEED * power) / 100;
  const radians = (angle * Math.PI) / 180;
  vx[stoneIndex] = Math.cos(radians) * speed;
  vy[stoneIndex] = -Math.sin(radians) * speed; // 화면 y는 아래로 커지므로 "위쪽"은 -y

  const frames: number[][] = [snapshot(stones)];
  const maxSteps = Math.floor(MAX_SECONDS / STEP);
  for (let step = 1; step <= maxSteps; step++) {
    let moving = false;
    stones.forEach((stone, index) => {
      if (!stone.alive) return;
      const currentSpeed = Math.hypot(vx[index] ?? 0, vy[index] ?? 0);
      if (currentSpeed < 1e-9) return;
      const slowed = Math.max(0, currentSpeed - FRICTION * STEP);
      vx[index] = (vx[index] ?? 0) * (slowed / currentSpeed);
      vy[index] = (vy[index] ?? 0) * (slowed / currentSpeed);
      stone.x += (vx[index] ?? 0) * STEP;
      stone.y += (vy[index] ?? 0) * STEP;
      if (slowed > 0) moving = true;
    });
    collide(stones, vx, vy);
    stones.forEach((stone, index) => {
      if (stone.alive && (stone.x < 0 || stone.x > BOARD_SIZE || stone.y < 0 || stone.y > BOARD_SIZE)) {
        stone.alive = false;
        vx[index] = 0;
        vy[index] = 0;
      }
    });
    if (step % STEPS_PER_FRAME === 0) frames.push(snapshot(stones));
    if (!moving) break;
  }
  frames.push(snapshot(stones));
  return { stones, frames };
};

/** 겹친 두 알: 중심을 잇는 방향의 속도를 주고받고, 겹친 만큼 반씩 밀어낸다(같은 무게) */
const collide = (stones: PhysicsStone[], vx: number[], vy: number[]) => {
  const minDistance = STONE_RADIUS * 2;
  for (let first = 0; first < stones.length; first++) {
    const a = stones[first];
    if (!a?.alive) continue;
    for (let second = first + 1; second < stones.length; second++) {
      const b = stones[second];
      if (!b?.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= minDistance || distance < 1e-9) continue;
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = (minDistance - distance) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const approaching = ((vx[first] ?? 0) - (vx[second] ?? 0)) * nx + ((vy[first] ?? 0) - (vy[second] ?? 0)) * ny;
      if (approaching <= 0) continue;
      const impulse = ((1 + RESTITUTION) / 2) * approaching;
      vx[first] = (vx[first] ?? 0) - impulse * nx;
      vy[first] = (vy[first] ?? 0) - impulse * ny;
      vx[second] = (vx[second] ?? 0) + impulse * nx;
      vy[second] = (vy[second] ?? 0) + impulse * ny;
    }
  }
};

/** 연습 판: 내 흑 알 4개(아래 줄) + 맞힐 백 알 6개(위쪽 두 줄, 엇갈리게) */
export const createPracticeStones = (): PhysicsStone[] => [
  ...[200, 400, 600, 800].map((x) => ({ side: 0, x, y: 800, alive: true })),
  ...[250, 500, 750].map((x) => ({ side: 1, x, y: 250, alive: true })),
  ...[375, 625].map((x) => ({ side: 1, x, y: 350, alive: true })),
  { side: 1, x: 500, y: 150, alive: true },
];

export const countAlive = (stones: PhysicsStone[], side: number) => stones.filter((stone) => stone.alive && stone.side === side).length;
