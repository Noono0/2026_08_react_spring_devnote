// catchMindRules.ts — 캐치마인드: 서버 상태의 모양(zod), 펜 색·굵기, 좌표 변환·그리기 도우미
//
// ★ 좌표를 "그림판 기준 1000×750"으로 주고받는 이유
//   사람마다 화면 크기가 다르다. 픽셀 좌표를 그대로 보내면 큰 화면에서 그린 그림이 작은 화면에서는 잘려 보인다.
//   그래서 보낼 때는 1000×750 기준으로 바꾸고(toCanvasPoint), 그릴 때는 캔버스 크기에 맞춰 늘리거나 줄인다.
import { z } from "zod";

/** 서버 CatchMindGame.CANVAS_WIDTH·CANVAS_HEIGHT와 같아야 한다 */
export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 750;
/** 한 번에 보낼 점 개수 상한(서버 MAX_NUMBERS_PER_STROKE = 400 → 색·굵기 2개를 빼고 점 199개) */
export const MAX_POINTS_PER_MESSAGE = 190;
/** 그리는 중에 이 시간(ms)마다 모은 점을 보낸다. 서버는 연결당 1초에 20개까지만 받으므로 넉넉히 둔다 */
export const DRAW_FLUSH_INTERVAL_MS = 120;
export const GUESS_MAX_LENGTH = 20;

/** 서버 COLOR_COUNT(8)와 개수가 같아야 한다. 순서가 곧 색 번호다 */
export const penColors = [
  { value: "#212529", label: "검정" }, { value: "#e03131", label: "빨강" }, { value: "#f08c00", label: "주황" },
  { value: "#fcc419", label: "노랑" }, { value: "#2f9e44", label: "초록" }, { value: "#1c7ed6", label: "파랑" },
  { value: "#9c36b5", label: "보라" }, { value: "#ffffff", label: "지우개(흰색)" },
] as const;

/** 서버가 허용하는 굵기(2~40) 안에서 고른 네 단계 */
export const penWidths = [
  { value: 4, label: "가늘게" }, { value: 8, label: "보통" }, { value: 16, label: "굵게" }, { value: 32, label: "아주 굵게" },
] as const;

const strokeSchema = z.object({
  color: z.number().int().min(0).max(penColors.length - 1),
  width: z.number().int().positive(),
  points: z.array(z.number().int()),
});

export type CatchMindStroke = z.infer<typeof strokeSchema>;

export const catchMindSchema = z.object({
  mySeat: z.number().int().nullish(),
  phase: z.enum(["DRAWING", "END"]),
  drawerSeat: z.number().int(),
  turnNumber: z.number().int().min(1),
  totalTurns: z.number().int().min(1),
  /** 출제자에게만 온다. 다른 사람은 null */
  word: z.string().nullish(),
  wordLength: z.number().int().min(0),
  strokes: z.array(strokeSchema),
  scores: z.array(z.number().int()),
  active: z.array(z.boolean()),
  guesses: z.array(z.string()),
  log: z.array(z.string()),
  winnerSeats: z.array(z.number().int()),
  finished: z.boolean(),
});

export type CatchMindView = z.infer<typeof catchMindSchema>;

export interface CanvasPoint {
  x: number;
  y: number;
}

interface ElementBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 마우스·손가락 위치(브라우저 화면 좌표) → 그림판 좌표(0~1000, 0~750 정수).
 * 그림판 밖으로 나가도 가장자리 값으로 맞춘다(서버는 범위 밖 점을 거절하므로).
 */
export const toCanvasPoint = (clientX: number, clientY: number, box: ElementBox): CanvasPoint => {
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value)));
  const x = box.width > 0 ? ((clientX - box.left) / box.width) * CANVAS_WIDTH : 0;
  const y = box.height > 0 ? ((clientY - box.top) / box.height) * CANVAS_HEIGHT : 0;
  return { x: clamp(x, CANVAS_WIDTH), y: clamp(y, CANVAS_HEIGHT) };
};

/** 서버로 보낼 DRAW의 numbers: [색 번호, 굵기, x1, y1, x2, y2, ...] */
export const toDrawNumbers = (color: number, width: number, points: CanvasPoint[]): number[] =>
  [color, width, ...points.flatMap((point) => [point.x, point.y])];

/** 이전 점과 이 거리(그림판 좌표) 미만이면 버린다. 손떨림 수준의 점까지 다 보내면 메시지만 커진다 */
export const isFarEnough = (previous: CanvasPoint | undefined, next: CanvasPoint, minimumDistance = 4): boolean =>
  !previous || Math.hypot(next.x - previous.x, next.y - previous.y) >= minimumDistance;

/** 선 하나를 캔버스에 그린다. 점이 하나뿐이면(콕 찍기) 동그라미를 찍는다 */
export const drawStroke = (context: CanvasRenderingContext2D, stroke: CatchMindStroke, scale: number) => {
  const color = penColors[stroke.color]?.value ?? penColors[0].value;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = stroke.width * scale;
  context.lineCap = "round";
  context.lineJoin = "round";
  const [firstX, firstY] = stroke.points;
  if (firstX === undefined || firstY === undefined) return;
  if (stroke.points.length === 2) {
    context.beginPath();
    context.arc(firstX * scale, firstY * scale, (stroke.width * scale) / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }
  context.beginPath();
  context.moveTo(firstX * scale, firstY * scale);
  for (let index = 2; index + 1 < stroke.points.length; index += 2) {
    const x = stroke.points[index];
    const y = stroke.points[index + 1];
    if (x !== undefined && y !== undefined) context.lineTo(x * scale, y * scale);
  }
  context.stroke();
};

/** 제시어 글자 수 힌트: "○○○ (3글자)" */
export const wordHint = (length: number) => `${"○".repeat(length)} (${length}글자)`;
