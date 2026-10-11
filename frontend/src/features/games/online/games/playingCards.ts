// playingCards.ts — 트럼프 카드 이름(code) 풀이. 서버 PlayingCard.code()와 짝: "S1"(♠A), "H13"(♥K), "BJ"(흑백 조커), "CJ"(컬러 조커)
import { z } from "zod";

export const playingCardSchema = z.object({ id: z.number().int(), code: z.string().regex(/^(?:[SHDC](?:[1-9]|1[0-3])|BJ|CJ)$/) });
export type PlayingCardView = z.infer<typeof playingCardSchema>;

export const SUIT_SYMBOLS: Record<string, string> = { S: "♠", H: "♥", D: "◆", C: "♣" };
export const SUIT_NAMES: Record<string, string> = { S: "스페이드", H: "하트", D: "다이아몬드", C: "클로버" };
const RANK_LABELS: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };

export interface ParsedCard {
  suit: string; // S·H·D·C, 조커는 BJ·CJ
  rank: number; // 1~13, 조커 0
  joker: boolean;
  red: boolean;
  label: string; // 화면 글자(예: "A", "10", "조커")
  name: string; // 읽어 주는 이름(예: "스페이드 A")
}

export const parseCard = (code: string): ParsedCard => {
  if (code === "BJ" || code === "CJ") {
    const color = code === "CJ";
    return { suit: code, rank: 0, joker: true, red: color, label: "JOKER", name: color ? "컬러 조커" : "흑백 조커" };
  }
  const suit = code.slice(0, 1);
  const rank = Number(code.slice(1));
  const label = RANK_LABELS[rank] ?? String(rank);
  return { suit, rank, joker: false, red: suit === "H" || suit === "D", label, name: `${SUIT_NAMES[suit] ?? suit} ${label}` };
};
