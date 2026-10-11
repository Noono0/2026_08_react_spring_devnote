// chessRules.ts — 체스 대전: 서버가 보내는 화면 상태의 모양(zod)과 기물 이름·칸 이름 도우미
import { z } from "zod";

const squareMove = z.array(z.number().int().min(0).max(7)).length(4);

export const chessSchema = z.object({
  mySeat: z.number().int().nullish(),
  myColor: z.enum(["WHITE", "BLACK"]).nullish(),
  /** 0번 줄 = 8랭크(흑 쪽). 대문자 = 백, 소문자 = 흑, "." = 빈칸 */
  board: z.array(z.string().regex(/^[KQRBNPkqrbnp.]{8}$/)).length(8),
  turnSeat: z.number().int().nullish(),
  inCheck: z.boolean(),
  lastMove: squareMove.nullish(),
  /** 내 차례일 때만 온다: [출발 행, 출발 열, 도착 행, 도착 열] */
  legalMoves: z.array(squareMove),
  history: z.array(z.string()),
  capturedByWhite: z.array(z.string()),
  capturedByBlack: z.array(z.string()),
  winnerSeat: z.number().int().nullish(),
  result: z.string().nullish(),
  finished: z.boolean(),
});

export type ChessView = z.infer<typeof chessSchema>;

const symbols: Record<string, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const names: Record<string, string> = { K: "킹", Q: "퀸", R: "룩", B: "비숍", N: "나이트", P: "폰" };

export const pieceSymbol = (piece: string) => symbols[piece] ?? "";

/** "P" → "백 폰", "q" → "흑 퀸" */
export const pieceName = (piece: string) => `${piece === piece.toUpperCase() ? "백" : "흑"} ${names[piece.toUpperCase()] ?? ""}`;

/** (행, 열) → "e2" */
export const squareName = (row: number, col: number) => `${String.fromCharCode(97 + col)}${8 - row}`;

export const promotionChoices = [
  { piece: "Q", label: "퀸" },
  { piece: "R", label: "룩" },
  { piece: "B", label: "비숍" },
  { piece: "N", label: "나이트" },
] as const;
