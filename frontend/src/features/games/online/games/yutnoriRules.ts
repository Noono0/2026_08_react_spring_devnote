// yutnoriRules.ts — 윷놀이: 서버가 보내는 화면 상태의 모양(zod), 판의 칸 위치, 화면 문구
//
// ★ 말이 어디로 갈 수 있는지는 서버(YutnoriGame.java)가 계산해 moves로 보내 준다.
//   화면이 길 계산을 똑같이 다시 만들면 두 곳의 규칙이 어긋날 수 있으므로, 화면은 "어디에 그릴지"만 안다.
import { z } from "zod";

export const WAITING_NODE = 0;
export const FINISHED_NODE = 30;

const throwSchema = z.enum(["DO", "GAE", "GEOL", "YUT", "MO"]);

export type YutThrow = z.infer<typeof throwSchema>;

export const yutnoriSchema = z.object({
  mySeat: z.number().int().nullish(),
  turnSeat: z.number().int(),
  phase: z.enum(["THROW", "MOVE", "END"]),
  /** 던져서 모아 둔 결과(아직 쓰지 않은 것). 순서가 MOVE의 throwIndex다 */
  pendingThrows: z.array(throwSchema),
  /** pieces[자리][말 번호] = 칸 번호(0 = 대기, 30 = 났음) */
  pieces: z.array(z.array(z.number().int().min(WAITING_NODE).max(FINISHED_NODE))),
  active: z.array(z.boolean()),
  /** 내 차례일 때만 온다: 말 번호 + 쓸 결과 번호 → 도착 칸 */
  moves: z.array(z.object({ piece: z.number().int(), throwIndex: z.number().int(), destination: z.number().int() })),
  log: z.array(z.string()),
  winnerSeat: z.number().int().nullish(),
  finished: z.boolean(),
});

export type YutnoriView = z.infer<typeof yutnoriSchema>;
export type YutnoriMove = YutnoriView["moves"][number];

export const throwLabels: Record<YutThrow, string> = { DO: "도", GAE: "개", GEOL: "걸", YUT: "윷", MO: "모" };

/** 자리별 말 색(최대 4명) */
export const playerColors = ["#e03131", "#1c7ed6", "#2f9e44", "#f08c00"] as const;

export interface BoardPoint {
  x: number;
  y: number;
}

/**
 * 칸 번호 → 판 위 위치(0~100 비율 좌표). SVG viewBox="0 0 100 100"에 그대로 쓴다.
 *   20(출발점)은 오른쪽 아래, 1~4는 오른쪽 변을 따라 위로, 5는 오른쪽 위 모서리…처럼 시계 반대 방향으로 돈다.
 *   21~29는 두 대각선(지름길) 위의 칸이고 23이 가운데 방이다.
 */
export const boardPoint = (node: number): BoardPoint | null => {
  const near = 10;
  const far = 90;
  const step = (far - near) / 5;
  const between = (from: BoardPoint, to: BoardPoint, ratio: number): BoardPoint =>
    ({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
  const center = { x: 50, y: 50 };
  if (node >= 1 && node <= 5) return { x: far, y: far - step * node };
  if (node >= 6 && node <= 10) return { x: far - step * (node - 5), y: near };
  if (node >= 11 && node <= 15) return { x: near, y: near + step * (node - 10) };
  if (node >= 16 && node <= 20) return { x: near + step * (node - 15), y: far };
  // 지름길: 각 대각선의 1/3, 2/3 지점
  if (node === 21) return between({ x: far, y: near }, center, 1 / 3);
  if (node === 22) return between({ x: far, y: near }, center, 2 / 3);
  if (node === 23) return center;
  if (node === 24) return between(center, { x: near, y: far }, 1 / 3);
  if (node === 25) return between(center, { x: near, y: far }, 2 / 3);
  if (node === 26) return between({ x: near, y: near }, center, 1 / 3);
  if (node === 27) return between({ x: near, y: near }, center, 2 / 3);
  if (node === 28) return between(center, { x: far, y: far }, 1 / 3);
  if (node === 29) return between(center, { x: far, y: far }, 2 / 3);
  return null; // 0(대기)·30(났음)은 판 밖
};

/** 판 위의 모든 칸 번호(1~29) */
export const boardNodes = Array.from({ length: 29 }, (_, index) => index + 1);

/** 모서리·가운데처럼 지름길로 들어가는 큰 칸 */
export const isCornerNode = (node: number) => node === 5 || node === 10 || node === 15 || node === 20 || node === 23;

/** "6번 칸" / "대기" / "났음" 같은 사람용 이름 */
export const nodeLabel = (node: number): string => {
  if (node === WAITING_NODE) return "대기";
  if (node === FINISHED_NODE) return "났음";
  if (node === 20) return "참먹이(20번 칸)";
  if (node === 23) return "가운데 방(23번 칸)";
  return `${node}번 칸`;
};

export interface PieceStack {
  seat: number;
  node: number;
  count: number;
}

/** 판 위에 그릴 말 묶음(같은 자리·같은 칸 = 업힌 말). 대기·났음은 빼고 센다 */
export const pieceStacks = (pieces: number[][]): PieceStack[] => {
  const stacks: PieceStack[] = [];
  pieces.forEach((seatPieces, seat) => {
    const countByNode = new Map<number, number>();
    for (const node of seatPieces) {
      if (node === WAITING_NODE || node === FINISHED_NODE) continue;
      countByNode.set(node, (countByNode.get(node) ?? 0) + 1);
    }
    countByNode.forEach((count, node) => stacks.push({ seat, node, count }));
  });
  return stacks;
};
