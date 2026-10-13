/**
 * billiardsAim.ts — 조준선 계산(화면 전용, 단위 mm)
 *
 * 실제 결과는 서버 물리가 정한다. 여기서는 "지금 방향으로 치면 처음 무엇에 닿는가"만 직선으로 예상해 보여 준다.
 *   - 공에 먼저 닿으면: 닿는 순간 수구 자리(고스트 볼), 맞은 공이 나갈 방향(두 중심을 잇는 선),
 *     수구가 갈라져 나갈 방향(회전이 없을 때 맞은 공 방향과 90°)
 *   - 쿠션에 먼저 닿으면: 닿는 점과 거울처럼 튕긴 다음 쿠션까지(회전·마찰은 넣지 않은 단순 예상)
 */
import type { BilliardsBall } from "@/features/games/online/games/billiards/billiardsRules";

export interface Point {
  x: number;
  y: number;
}

export interface TableSize {
  length: number;
  width: number;
  radius: number;
}

export type AimPreview =
  | { kind: "BALL"; path: Point[]; ghost: Point; targetId: number; objectDirection: Point; cueDirection: Point | null }
  | { kind: "CUSHION"; path: Point[] };

/** 조준 각도(도) → 서버 값(1/1000도, 0 이상 360000 미만) */
export const toMilliDegrees = (degrees: number): number => {
  const normalized = ((degrees % 360) + 360) % 360;
  return Math.round(normalized * 1000) % 360_000;
};

export const degreesBetween = (from: Point, to: Point): number => {
  const degrees = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
};

/** 수구에서 가장 가까운 다른 공 쪽 각도(차례가 올 때 처음 조준) */
export const nearestBallAngle = (balls: BilliardsBall[], cueId: number, preferredIds: number[] = []): number => {
  const cue = balls.find((ball) => ball.id === cueId && !ball.pocketed);
  if (!cue) return 0;
  const others = balls.filter((ball) => ball.id !== cueId && !ball.pocketed);
  const preferred = others.filter((ball) => preferredIds.includes(ball.id));
  const candidates = preferred.length > 0 ? preferred : others;
  let best: BilliardsBall | null = null;
  for (const ball of candidates) {
    if (!best || Math.hypot(ball.x - cue.x, ball.y - cue.y) < Math.hypot(best.x - cue.x, best.y - cue.y)) best = ball;
  }
  return best ? degreesBetween(cue, best) : 0;
};

/** 점 p에서 방향 d로 갈 때 레일(공 중심 기준 안쪽 선)에 닿는 거리와 그 레일의 법선 */
const firstCushion = (p: Point, d: Point, table: TableSize): { distance: number; normal: Point } => {
  const candidates: { distance: number; normal: Point }[] = [];
  if (d.x > 1e-9) candidates.push({ distance: (table.length - table.radius - p.x) / d.x, normal: { x: -1, y: 0 } });
  if (d.x < -1e-9) candidates.push({ distance: (table.radius - p.x) / d.x, normal: { x: 1, y: 0 } });
  if (d.y > 1e-9) candidates.push({ distance: (table.width - table.radius - p.y) / d.y, normal: { x: 0, y: -1 } });
  if (d.y < -1e-9) candidates.push({ distance: (table.radius - p.y) / d.y, normal: { x: 0, y: 1 } });
  return candidates.reduce((best, next) => (next.distance < best.distance ? next : best), { distance: Infinity, normal: { x: 0, y: 0 } });
};

/** 점 p에서 방향 d로 갈 때 처음 닿는 공(중심 거리 2R)까지의 거리 */
const firstBall = (p: Point, d: Point, balls: BilliardsBall[], skipId: number, radius: number): { distance: number; ball: BilliardsBall } | null => {
  let found: { distance: number; ball: BilliardsBall } | null = null;
  for (const ball of balls) {
    if (ball.id === skipId || ball.pocketed) continue;
    const fx = ball.x - p.x;
    const fy = ball.y - p.y;
    const along = fx * d.x + fy * d.y;
    if (along <= 0) continue;
    const across = fx * fx + fy * fy - along * along;
    const reach = 4 * radius * radius - across;
    if (reach < 0) continue;
    const distance = along - Math.sqrt(reach);
    if (distance >= 0 && (!found || distance < found.distance)) found = { distance, ball };
  }
  return found;
};

const normalize = (vector: Point): Point => {
  const length = Math.hypot(vector.x, vector.y);
  return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length };
};

export const previewAim = (table: TableSize, balls: BilliardsBall[], cueId: number, degrees: number): AimPreview | null => {
  const cue = balls.find((ball) => ball.id === cueId && !ball.pocketed);
  if (!cue) return null;
  const radians = (degrees * Math.PI) / 180;
  let direction: Point = { x: Math.cos(radians), y: Math.sin(radians) };
  let position: Point = { x: cue.x, y: cue.y };
  const path: Point[] = [position];
  // 쿠션 두 번까지만 따라간다(그 뒤는 회전 때문에 직선 예상이 크게 틀린다)
  for (let bounce = 0; bounce < 3; bounce++) {
    const ballHit = firstBall(position, direction, balls, cueId, table.radius);
    const cushion = firstCushion(position, direction, table);
    if (ballHit && ballHit.distance <= cushion.distance) {
      const ghost = { x: position.x + direction.x * ballHit.distance, y: position.y + direction.y * ballHit.distance };
      path.push(ghost);
      const objectDirection = normalize({ x: ballHit.ball.x - ghost.x, y: ballHit.ball.y - ghost.y });
      const along = direction.x * objectDirection.x + direction.y * objectDirection.y;
      const tangent = { x: direction.x - along * objectDirection.x, y: direction.y - along * objectDirection.y };
      // 정면으로 맞히면 수구는 그 자리에 선다(갈라질 방향 없음)
      const cueDirection = Math.hypot(tangent.x, tangent.y) < 0.02 ? null : normalize(tangent);
      return { kind: "BALL", path, ghost, targetId: ballHit.ball.id, objectDirection, cueDirection };
    }
    if (!Number.isFinite(cushion.distance)) break;
    position = { x: position.x + direction.x * cushion.distance, y: position.y + direction.y * cushion.distance };
    path.push(position);
    const dot = direction.x * cushion.normal.x + direction.y * cushion.normal.y;
    direction = { x: direction.x - 2 * dot * cushion.normal.x, y: direction.y - 2 * dot * cushion.normal.y };
  }
  return { kind: "CUSHION", path };
};

/** 수구를 놓을 수 있는 곳인가(테이블 안, 다른 공과 겹치지 않음) */
export const canPlaceCue = (table: TableSize, balls: BilliardsBall[], point: Point): boolean => {
  if (point.x < table.radius || point.y < table.radius || point.x > table.length - table.radius || point.y > table.width - table.radius) return false;
  return balls.every((ball) => ball.id === 0 || ball.pocketed || Math.hypot(ball.x - point.x, ball.y - point.y) >= 2 * table.radius + 1);
};

/** 프레임 사이를 이어 그린 위치(mm). 들어간 공은 null */
export const positionAt = (frames: number[][], ballIndex: number, elapsedMs: number, frameMs: number): Point | null => {
  const exact = Math.max(0, elapsedMs / frameMs);
  const index = Math.min(frames.length - 1, Math.floor(exact));
  const next = Math.min(frames.length - 1, index + 1);
  const from = frames[index];
  const to = frames[next];
  const fromX = from?.[ballIndex * 2] ?? -1;
  const fromY = from?.[ballIndex * 2 + 1] ?? -1;
  if (fromX < 0) return null;
  const toX = to?.[ballIndex * 2] ?? -1;
  const toY = to?.[ballIndex * 2 + 1] ?? -1;
  if (toX < 0) return { x: fromX, y: fromY };
  const ratio = exact - index;
  return { x: fromX + (toX - fromX) * ratio, y: fromY + (toY - fromY) * ratio };
};
