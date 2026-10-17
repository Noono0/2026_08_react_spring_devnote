// alkkagiRules.ts — 알까기: 서버 화면 상태의 모양(zod)과 조준 계산(순수 함수)
//
// ★ 충돌·마찰·떨어짐은 서버(AlkkagiGame.java)가 계산한다. 화면은 "어느 쪽으로 얼마나 세게"만 정해서 보내고,
//   돌아온 궤적(frames)을 그대로 재생한다.
import { z } from "zod";

/** 서버 AlkkagiGame.BOARD_SIZE·STONE_RADIUS와 같아야 한다 */
export const ALKKAGI_BOARD = 1000;
export const ALKKAGI_STONE_RADIUS = 24;
export const MIN_POWER = 5;
export const MAX_POWER = 100;
/** 새총처럼 끌어당긴 거리(판 단위) → 힘. 이만큼 당기면 힘 100 */
export const FULL_PULL_DISTANCE = 300;
export const REPLAY_FRAME_MS = 1000 / 30;

const shotSchema = z.object({
  seq: z.number().int(),
  shooterSeat: z.number().int(),
  stone: z.number().int(),
  angle: z.number().int(),
  power: z.number().int(),
  /** frames[n] = [x0, y0, x1, y1, ...]. 떨어진 알은 -1 */
  frames: z.array(z.array(z.number().int())),
  knockedOpponent: z.number().int(),
  knockedOwn: z.number().int(),
});

export const alkkagiSchema = z.object({
  mySeat: z.number().int().nullish(),
  phase: z.enum(["PLAY", "END"]),
  turnSeat: z.number().int(),
  stones: z.array(z.object({ side: z.number().int(), x: z.number().int(), y: z.number().int(), alive: z.boolean() })),
  remaining: z.array(z.number().int()).length(2),
  shotCount: z.number().int(),
  lastShot: shotSchema.nullish(),
  log: z.array(z.string()),
  winnerSeat: z.number().int().nullish(),
  finished: z.boolean(),
});

export type AlkkagiView = z.infer<typeof alkkagiSchema>;

export interface BoardPoint {
  x: number;
  y: number;
}

/** 화면 좌표 → 판 좌표(0~1000) */
export const toBoardPoint = (clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }): BoardPoint => ({
  x: box.width > 0 ? ((clientX - box.left) / box.width) * ALKKAGI_BOARD : 0,
  y: box.height > 0 ? ((clientY - box.top) / box.height) * ALKKAGI_BOARD : 0,
});

/**
 * 새총 조준: 알에서 손가락 쪽으로 당기면 그 "반대쪽"으로 날아간다.
 * 각도는 0 = 오른쪽, 90 = 위쪽(화면 y는 아래로 커지므로 부호를 뒤집는다).
 */
export const aimFromPull = (stone: BoardPoint, pointer: BoardPoint): { angle: number; power: number } => {
  const dx = stone.x - pointer.x;
  const dy = stone.y - pointer.y;
  const degrees = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI);
  const angle = ((degrees % 360) + 360) % 360;
  const power = Math.round(Math.min(MAX_POWER, Math.max(MIN_POWER, (Math.hypot(dx, dy) / FULL_PULL_DISTANCE) * MAX_POWER)));
  return { angle, power };
};

/** 조준선 끝점: 알에서 각도 방향으로 힘에 비례한 길이 */
export const aimLineEnd = (stone: BoardPoint, angle: number, power: number): BoardPoint => {
  const length = (power / MAX_POWER) * FULL_PULL_DISTANCE;
  const radians = (angle * Math.PI) / 180;
  return { x: stone.x + Math.cos(radians) * length, y: stone.y - Math.sin(radians) * length };
};

/** 재생 프레임 하나 → 알 위치 목록(떨어진 알은 null) */
export const framePositions = (frame: number[]): (BoardPoint | null)[] => {
  const positions: (BoardPoint | null)[] = [];
  for (let index = 0; index + 1 < frame.length; index += 2) {
    const x = frame[index] ?? -1;
    const y = frame[index + 1] ?? -1;
    positions.push(x < 0 || y < 0 ? null : { x, y });
  }
  return positions;
};
