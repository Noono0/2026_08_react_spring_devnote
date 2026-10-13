// tetrisControls.ts — 테트리스 키 배치. 혼자 하기(TetrisPage)와 온라인 대전(OnlineTetrisGame)이 함께 쓴다.
import type { TetrisAction } from "@/features/games/tetris/tetrisLogic";

/** 키 → action. 같은 동작에 키를 두 개씩 둔 것은 키보드 배치마다 편한 키가 달라서다. */
export const tetrisKeyActions: Record<string, TetrisAction> = {
  ArrowLeft: { type: "MOVE", offset: -1 },
  ArrowRight: { type: "MOVE", offset: 1 },
  ArrowDown: { type: "SOFT_DROP" },
  ArrowUp: { type: "ROTATE", direction: "CW" },
  x: { type: "ROTATE", direction: "CW" },
  X: { type: "ROTATE", direction: "CW" },
  z: { type: "ROTATE", direction: "CCW" },
  Z: { type: "ROTATE", direction: "CCW" },
  " ": { type: "HARD_DROP" },
  c: { type: "HOLD" },
  C: { type: "HOLD" },
  Shift: { type: "HOLD" },
  p: { type: "TOGGLE_PAUSE" },
  P: { type: "TOGGLE_PAUSE" },
  Escape: { type: "TOGGLE_PAUSE" },
};
