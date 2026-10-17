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
  /** 방 옵션: STANDARD(정석·정해진 자리) · CUSTOM(최대 개수를 정하고 자유 배치) */
  mode: z.enum(["STANDARD", "CUSTOM"]),
  /** SETUP = 커스텀 배치 중. 이때 stones에는 내가 놓은 알만 온다 */
  phase: z.enum(["SETUP", "PLAY", "END"]),
  maxStones: z.number().int(),
  /** 자리마다 놓은 알 개수(배치 중 상대는 개수만 보인다) */
  placedCounts: z.array(z.number().int()).length(2),
  ready: z.array(z.boolean()).length(2),
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

/** 바둑판 19줄(서버 AlkkagiGame.GRID_*와 같다): 교차점 (칸, 줄) → (50 + 50 × 칸, 50 + 50 × 줄) */
export const GRID_LINES = 19;
export const GRID_START = 50;
export const GRID_STEP = 50;

export interface GridPoint {
  col: number;
  row: number;
}

/** 판 좌표 → 가장 가까운 교차점. 판 테두리 밖이면 null */
export const snapToGrid = (point: BoardPoint): GridPoint | null => {
  // ★ Math.round(-0.4)는 -0이다. "+ 0"으로 0으로 바꿔 두어야 서버로 보내는 값·비교가 깔끔하다
  const col = Math.round((point.x - GRID_START) / GRID_STEP) + 0;
  const row = Math.round((point.y - GRID_START) / GRID_STEP) + 0;
  if (col < 0 || col >= GRID_LINES || row < 0 || row >= GRID_LINES) return null;
  return { col, row };
};

export const gridToBoard = ({ col, row }: GridPoint): BoardPoint => ({ x: GRID_START + GRID_STEP * col, y: GRID_START + GRID_STEP * row });

/** 커스텀 배치에서 내가 놓을 수 있는 줄인지(흑 = 아래 10~18줄, 백 = 위 0~8줄). 서버도 같은 규칙으로 다시 검사한다 */
export const isOwnHalf = (side: number, row: number) => (side === 0 ? row >= 10 && row < GRID_LINES : row >= 0 && row <= 8);

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
