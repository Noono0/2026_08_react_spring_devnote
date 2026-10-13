import { describe, expect, it } from "vitest";
import {
  applyGravity,
  chainScore,
  collides,
  createEmptyPuyoBoard,
  createPuyoState,
  dropNuisance,
  findPopGroups,
  nuisanceForScore,
  parseColorCount,
  puyoReducer,
  resolveChains,
  toBoardText,
  type ColorPuyo,
  type PuyoAction,
  type PuyoBoard,
  type PuyoState,
} from "./puyoLogic";

const run = (state: PuyoState, ...actions: PuyoAction[]): PuyoState => actions.reduce(puyoReducer, state);
const started = (seed = 1, colorCount: 3 | 4 | 5 = 4): PuyoState =>
  puyoReducer(createPuyoState(), { type: "START", seed, colorCount });

const paint = (cells: Array<[number, number, ColorPuyo | "N"]>): PuyoBoard => {
  const board = createEmptyPuyoBoard();
  for (const [row, col, color] of cells) {
    const target = board[row];
    if (target) target[col] = color;
  }
  return board;
};

const at = (board: PuyoBoard, row: number, col: number) => board[row]?.[col] ?? null;

describe("색 수·쌍 회전", () => {
  it("방 옵션 문자열이 3 또는 5일 때만 쓰고, 아니면 4색이다", () => {
    expect(parseColorCount("3")).toBe(3);
    expect(parseColorCount("5")).toBe(5);
    expect(parseColorCount("4")).toBe(4);
    expect(parseColorCount("x")).toBe(4);
    expect(parseColorCount(null)).toBe(4);
  });

  it("시계 방향으로 네 번 돌리면 원래 자리, 벽에 걸리면 옆으로 민다", () => {
    const state = started(7);
    const first = state.active;
    expect(first).not.toBeNull();
    if (!first) return;
    const afterFour = run(state, { type: "ROTATE", direction: "CW" }, { type: "ROTATE", direction: "CW" }, { type: "ROTATE", direction: "CW" }, { type: "ROTATE", direction: "CW" });
    expect(afterFour.active).toMatchObject({ row: first.row, col: first.col, rotation: first.rotation });

    let atRight = state;
    for (let step = 0; step < 6; step += 1) atRight = puyoReducer(atRight, { type: "MOVE", offset: 1 });
    expect(atRight.active?.col).toBeLessThan(6);
    const kicked = puyoReducer(atRight, { type: "ROTATE", direction: "CW" });
    expect(kicked.active).not.toBeNull();
    expect(collides(kicked.board, kicked.active!)).toBe(false);
  });
});

describe("중력·터짐·연쇄", () => {
  it("칸이 아래로 쌓이고 빈 칸은 위에 남는다", () => {
    const board = paint([[1, 0, "R"], [5, 0, "G"]]);
    const fallen = applyGravity(board);
    expect(at(fallen, 11, 0)).toBe("R");
    expect(at(fallen, 12, 0)).toBe("G");
    expect(at(fallen, 1, 0)).toBeNull();
  });

  it("같은 색 4개가 이어지면 터지고, 붙어 있는 방해 뿌요도 사라진다", () => {
    const board = paint([
      [12, 0, "R"], [12, 1, "R"], [12, 2, "R"], [12, 3, "R"],
      [11, 0, "N"], [11, 5, "N"],
    ]);
    const groups = findPopGroups(board);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.cells).toHaveLength(4);
    const resolved = resolveChains(board);
    expect(resolved.chain).toBe(1);
    expect(at(resolved.board, 12, 0)).toBeNull();
    expect(at(resolved.board, 11, 0)).toBeNull();
    expect(at(resolved.board, 12, 5)).toBe("N");
  });

  it("한 번 터진 뒤 떨어진 뿌요가 다시 4개가 되면 연쇄가 이어진다", () => {
    const board = paint([
      [12, 0, "G"], [11, 0, "G"], [10, 0, "G"],
      [10, 1, "R"], [10, 2, "R"], [10, 3, "R"], [10, 4, "R"],
      [9, 1, "G"],
    ]);
    const resolved = resolveChains(board);
    expect(resolved.chain).toBe(2);
    expect(resolved.board.flat().filter((cell) => cell !== null)).toHaveLength(0);
    expect(resolved.score).toBe(
      chainScore(1, [{ color: "R", cells: [[10, 1], [10, 2], [10, 3], [10, 4]] }])
      + chainScore(2, [{ color: "G", cells: [[12, 0], [11, 0], [10, 0], [12, 1]] }]),
    );
  });

  it("4개 터짐은 40점이고 70점 미만은 방해를 보내지 않는다", () => {
    expect(chainScore(1, [{ color: "R", cells: [[0, 0], [0, 1], [0, 2], [0, 3]] }])).toBe(40);
    expect(nuisanceForScore(40)).toBe(0);
    expect(nuisanceForScore(320)).toBe(4);
  });
});

describe("리듀서", () => {
  it("같은 시드는 같은 순서의 쌍을 준다", () => {
    const a = started(42);
    const b = started(42);
    expect(a.queue).toEqual(b.queue);
    expect(a.active).toEqual(b.active);
  });

  it("3색이면 노랑·보라가 나오지 않는다", () => {
    let state = started(9, 3);
    const seen = new Set<ColorPuyo>();
    for (let i = 0; i < 40; i += 1) {
      if (state.active) {
        seen.add(state.active.axis);
        seen.add(state.active.child);
      }
      state = puyoReducer(state, { type: "HARD_DROP" });
      if (state.status === "GAME_OVER") break;
    }
    expect(seen.has("Y")).toBe(false);
    expect(seen.has("P")).toBe(false);
    expect(seen.size).toBeGreaterThan(0);
  });

  it("바로 떨어뜨리면 바닥에 굳고 다음 쌍이 나온다", () => {
    const state = started(3);
    const first = state.active;
    const dropped = puyoReducer(state, { type: "HARD_DROP" });
    expect(dropped.pairCount).toBe(state.pairCount + 1);
    expect(dropped.active).not.toEqual(first);
    expect(toBoardText(dropped.board)).toHaveLength(72);
    expect(dropped.board[12]?.some((cell) => cell !== null) || dropped.board[11]?.some((cell) => cell !== null)).toBe(true);
  });

  it("받은 방해는 쌓아 두었다가 쌍이 굳은 뒤에 떨어진다", () => {
    const waiting = puyoReducer(started(1), { type: "ADD_GARBAGE", count: 3 });
    expect(waiting.pendingNuisance).toBe(3);
    expect(waiting.board.flat().filter((cell) => cell === "N")).toHaveLength(0);
    const locked = puyoReducer(waiting, { type: "HARD_DROP" });
    expect(locked.board.flat().filter((cell) => cell === "N").length).toBeGreaterThanOrEqual(3);
    expect(locked.pendingNuisance).toBe(0);
  });

  it("판 요약은 보이는 12줄×6칸=72글자이다", () => {
    const { board, remaining } = dropNuisance(createEmptyPuyoBoard(), 8);
    expect(remaining).toBe(0);
    expect(toBoardText(board)).toBe(".".repeat(60) + "NN...." + "N".repeat(6));
  });

  it("숨은 줄까지 막히면 게임 끝이다", () => {
    let state = started(1);
    const full = createEmptyPuyoBoard().map((row) => row.map(() => "N" as const));
    state = { ...state, board: full };
    const ended = puyoReducer(state, { type: "HARD_DROP" });
    expect(ended.status).toBe("GAME_OVER");
  });
});
