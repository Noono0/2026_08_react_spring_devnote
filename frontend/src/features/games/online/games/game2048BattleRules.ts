// game2048BattleRules.ts — 2048 대전: 서버가 보내는 화면 상태의 모양(zod)과 키 → 방향
//
// 판을 미는 규칙·새 타일은 서버(Game2048Game.java)가 정한다. 모두 같은 처음 판·같은 순서의 새 타일을 받으므로
// 실력(이동 수)만으로 겨룬다. 화면은 혼자 하기 규칙 함수(moveBoard)로 "밀어도 그대로인 방향"만 미리 걸러 보내지 않는다.
import { z } from "zod";
import { BOARD_SIZE, type Direction } from "@/features/games/game2048/game2048Logic";
import { racePlayerFields } from "@/features/games/online/games/raceBattleRules";

const boardSchema = z.array(z.array(z.number().int().min(0)).length(BOARD_SIZE)).length(BOARD_SIZE);

export const game2048BattleSchema = z.object({
  mySeat: z.number().int().nullish(),
  /** 방장이 고른 목표 타일(256·512·1024·2048) */
  target: z.number().int().positive(),
  /** 판은 모두에게 공개된다(숨길 정보가 없다) */
  players: z.array(z.object({
    ...racePlayerFields,
    board: boardSchema,
    score: z.number().int().min(0),
    moves: z.number().int().min(0),
  })),
  winners: z.array(z.number().int()),
  finished: z.boolean(),
});

export type Game2048BattleView = z.infer<typeof game2048BattleSchema>;
export type Game2048BattlePlayer = Game2048BattleView["players"][number];

export const keyDirections: Record<string, Direction> = {
  ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
  w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT",
  W: "UP", S: "DOWN", A: "LEFT", D: "RIGHT",
};

export const directionLabels: Record<Direction, string> = { UP: "위", DOWN: "아래", LEFT: "왼쪽", RIGHT: "오른쪽" };

/** 타일 값 → games.css의 색 클래스. 2048보다 큰 타일은 한 가지 색 */
export const tileClassName = (value: number): string => (value === 0 ? "tile-empty" : value > 2048 ? "tile-super" : `tile-${value}`);
