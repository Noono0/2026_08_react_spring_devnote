// janggiRules.ts — 장기: 서버 화면 상태의 모양(zod), 기물 이름·한자, 상차림 이름
//
// ★ 기물이 어디로 갈 수 있는지(합법수)는 서버(JanggiGame.java)가 계산해 moves로 보낸다.
//   화면은 그 목록으로 점만 찍는다. 체스 화면(ChessGame.tsx)과 같은 방식이다.
import { z } from "zod";

export const JANGGI_ROWS = 10;
export const JANGGI_COLS = 9;

const moveSchema = z.object({ fromRow: z.number().int(), fromCol: z.number().int(), toRow: z.number().int(), toCol: z.number().int() });

export const janggiSchema = z.object({
  mySeat: z.number().int().nullish(),
  phase: z.enum(["SETUP", "PLAY", "END"]),
  /** 10줄 × 9글자. 대문자 = 초, 소문자 = 한, '.' = 빈칸 */
  board: z.array(z.string().length(JANGGI_COLS)).length(JANGGI_ROWS),
  arranged: z.array(z.boolean()).length(2),
  myFormation: z.string().nullish(),
  turnSeat: z.number().int(),
  inCheck: z.boolean(),
  /** 직전 수로 두 궁이 마주 봄(빅장). 지금 둘 사람이 풀지 않으면 점수로 끝난다 */
  bikjang: z.boolean(),
  moves: z.array(moveSchema),
  canPass: z.boolean(),
  lastMove: moveSchema.nullish(),
  /** [초, 한] 반 점 단위(점수 × 2) */
  scores: z.array(z.number().int()).length(2),
  moveCount: z.number().int(),
  log: z.array(z.string()),
  winnerSeat: z.number().int().nullish(),
  result: z.string().nullish(),
  finished: z.boolean(),
});

export type JanggiView = z.infer<typeof janggiSchema>;
export type JanggiMove = z.infer<typeof moveSchema>;

/** 상차림(서버 JanggiGame.FORMATIONS). 글자는 내 쪽에서 본 바깥 왼쪽 두 칸 + 오른쪽 두 칸(H = 마, E = 상) */
export const formations = [
  { code: "HEHE", label: "마상마상", description: "양쪽 모두 바깥에 마" },
  { code: "EHEH", label: "상마상마", description: "양쪽 모두 바깥에 상" },
  { code: "HEEH", label: "마상상마", description: "상을 안쪽(궁 쪽)에 모음" },
  { code: "EHHE", label: "상마마상", description: "마를 안쪽(궁 쪽)에 모음" },
] as const;

const PIECE_NAMES: Record<string, string> = { K: "궁", R: "차", C: "포", H: "마", E: "상", A: "사", P: "졸" };
/** 판에 쓰는 한자. 궁과 졸은 초·한이 다르다 */
const PIECE_HANJA: Record<string, string> = { R: "車", C: "包", H: "馬", E: "象", A: "士" };

export const isCho = (piece: string) => piece !== "." && piece === piece.toUpperCase();

export const pieceName = (piece: string): string => {
  const type = piece.toUpperCase();
  const name = type === "P" && !isCho(piece) ? "병" : PIECE_NAMES[type] ?? "";
  return `${isCho(piece) ? "초" : "한"} ${name}`;
};

export const pieceHanja = (piece: string): string => {
  const type = piece.toUpperCase();
  if (type === "K") return isCho(piece) ? "楚" : "漢";
  if (type === "P") return isCho(piece) ? "卒" : "兵";
  return PIECE_HANJA[type] ?? "";
};

/** 칸 이름(화면 낭독기용): "3줄 5칸" — 줄은 위에서부터, 칸은 왼쪽부터(초 쪽 기준) */
export const pointName = (row: number, col: number) => `${row + 1}줄 ${col + 1}칸`;

/** 궁성 대각선(배경에 그릴 선): 위 궁성과 아래 궁성 각각 X자 */
export const palaceDiagonals = [
  { x1: 3, y1: 0, x2: 5, y2: 2 }, { x1: 5, y1: 0, x2: 3, y2: 2 },
  { x1: 3, y1: 7, x2: 5, y2: 9 }, { x1: 5, y1: 7, x2: 3, y2: 9 },
];

/** 반 점 단위 점수 → "72.5" */
export const formatScore = (halfPoints: number) => (halfPoints / 2).toFixed(1);
