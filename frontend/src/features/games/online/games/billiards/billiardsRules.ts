// billiardsRules.ts — 당구: 서버가 보내는 화면 상태의 모양(zod)과 공 색·이름 도우미
import { z } from "zod";

const ballSchema = z.object({ id: z.number().int().min(0).max(15), x: z.number().int(), y: z.number().int(), pocketed: z.boolean() });

const eventSchema = z.object({
  timeMs: z.number().int().min(0),
  type: z.enum(["BALL", "CUSHION", "POCKET"]),
  a: z.number().int(),
  b: z.number().int(),
});

export const billiardsSchema = z.object({
  variant: z.enum(["THREE_CUSHION", "FOUR_BALL", "EIGHT_BALL"]),
  variantLabel: z.string(),
  /** 테이블 안쪽(공이 굴러다니는 면) 크기, mm */
  tableLength: z.number().int().positive(),
  tableWidth: z.number().int().positive(),
  ballRadius: z.number().positive(),
  pockets: z.boolean(),
  balls: z.array(ballSchema),
  mySeat: z.number().int().nullish(),
  turnSeat: z.number().int().nullish(),
  /** 자리마다 치는 공 번호(3쿠션·4구: 0 흰 공, 1 노란 공 / 8볼: 둘 다 0) */
  cueBalls: z.array(z.number().int()),
  scores: z.array(z.number().int()),
  target: z.number().int(),
  innings: z.array(z.number().int()),
  /** 8볼: 자리마다 SOLID(1~7)·STRIPE(9~15). 정해지기 전에는 null */
  groups: z.array(z.enum(["SOLID", "STRIPE"]).nullable()),
  /** 8볼 파울 뒤: 지금 차례인 사람이 수구를 원하는 곳에 놓을 수 있다 */
  ballInHand: z.boolean(),
  /** 마지막 샷의 궤적. frames[i] = [공0 x, 공0 y, 공1 x, ...] (mm, 1/30초 간격, 들어간 공은 -1) */
  lastShot: z.object({
    seq: z.number().int(),
    shooterSeat: z.number().int(),
    cueBall: z.number().int(),
    frames: z.array(z.array(z.number().int())).min(1),
    events: z.array(eventSchema),
    durationMs: z.number().int(),
    summary: z.string(),
  }).nullish(),
  winners: z.array(z.number().int()),
  result: z.string().nullish(),
  finished: z.boolean(),
});

export type BilliardsView = z.infer<typeof billiardsSchema>;
export type BilliardsBall = z.infer<typeof ballSchema>;
export type BilliardsShot = NonNullable<BilliardsView["lastShot"]>;
export type BilliardsEvent = z.infer<typeof eventSchema>;
export type BilliardsVariant = BilliardsView["variant"];

/** 서버 궤적의 프레임 간격(ms) */
export const FRAME_MS = 1000 / 30;

/** 8볼 공 색(1~8, 9~15는 줄무늬로 같은 색 반복) */
const poolColors = ["#f4f1e8", "#f2c200", "#1f4fbf", "#d11a1a", "#5b2a86", "#f07a12", "#127a3a", "#7a1f1f", "#151515"];

export interface BallLook {
  /** 바탕 색 */
  base: string;
  /** 줄무늬 공이면 띠 색 */
  stripe: string | null;
  /** 공에 쓰는 번호(캐롬 공은 없음) */
  number: number | null;
  name: string;
}

export const ballLook = (variant: BilliardsVariant, id: number): BallLook => {
  if (variant !== "EIGHT_BALL") {
    if (id === 0) return { base: "#f7f5ee", stripe: null, number: null, name: "흰 공" };
    if (id === 1) return { base: "#f3c623", stripe: null, number: null, name: "노란 공" };
    return { base: "#c8161d", stripe: null, number: null, name: variant === "FOUR_BALL" && id === 3 ? "빨간 공 2" : "빨간 공" };
  }
  if (id === 0) return { base: "#f7f5ee", stripe: null, number: null, name: "수구" };
  if (id <= 8) return { base: poolColors[id] ?? "#151515", stripe: null, number: id, name: `${id}번` };
  return { base: "#f7f5ee", stripe: poolColors[id - 8] ?? "#151515", number: id, name: `${id}번` };
};

export const variantRule: Record<BilliardsVariant, string> = {
  THREE_CUSHION: "내 공으로 두 공을 모두 맞히되, 두 번째 공을 맞히기 전까지 쿠션에 3번 이상 닿으면 1점. 득점하면 계속 칩니다.",
  FOUR_BALL: "내 공으로 빨간 공 두 개를 모두 맞히면 1점. 상대 공을 맞히면 1점을 잃고 차례가 넘어갑니다.",
  EIGHT_BALL: "처음 넣은 공으로 솔리드(1~7)·스트라이프(9~15)가 정해집니다. 내 무리를 다 넣고 8번을 넣으면 승리. 파울이면 상대가 수구를 원하는 곳에 놓고 칩니다.",
};
