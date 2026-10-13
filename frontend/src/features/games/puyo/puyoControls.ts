// puyoControls.ts — 뿌요뿌요 키 배치. 혼자 연습과 온라인 대전이 함께 쓴다.
import type { PuyoAction } from "@/features/games/puyo/puyoLogic";

export const puyoKeyActions: Record<string, PuyoAction> = {
  ArrowLeft: { type: "MOVE", offset: -1 },
  ArrowRight: { type: "MOVE", offset: 1 },
  ArrowDown: { type: "SOFT_DROP" },
  ArrowUp: { type: "ROTATE", direction: "CW" },
  x: { type: "ROTATE", direction: "CW" },
  X: { type: "ROTATE", direction: "CW" },
  z: { type: "ROTATE", direction: "CCW" },
  Z: { type: "ROTATE", direction: "CCW" },
  " ": { type: "HARD_DROP" },
  p: { type: "TOGGLE_PAUSE" },
  P: { type: "TOGGLE_PAUSE" },
  Escape: { type: "TOGGLE_PAUSE" },
};
