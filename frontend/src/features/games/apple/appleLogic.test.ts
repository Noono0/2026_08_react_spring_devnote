import {
  APPLE_COLUMNS, APPLE_ROWS, applySelection, countApples, createAppleBoard, summarizeRect, toRect, type AppleBoard,
} from "@/features/games/apple/appleLogic";

const smallBoard = (): AppleBoard => [
  [1, 9, 5, 5],
  [2, 3, 5, 1],
  [8, 4, 0, 6],
];

describe("appleLogic", () => {
  it("17칸 × 10줄 판에 1~9 숫자를 채운다", () => {
    const values = [0, 0.5, 0.999];
    let index = 0;
    const board = createAppleBoard(() => values[index++ % values.length] ?? 0);
    expect(board).toHaveLength(APPLE_ROWS);
    expect(board[0]).toHaveLength(APPLE_COLUMNS);
    expect(board[0]?.slice(0, 3)).toEqual([1, 5, 9]);
    expect(countApples(board)).toBe(APPLE_ROWS * APPLE_COLUMNS);
  });

  it("두 칸 순서와 상관없이 사각형을 만들고, 없앤 자리(0)는 합·개수에서 뺀다", () => {
    expect(toRect({ row: 2, col: 3 }, { row: 0, col: 1 })).toEqual({ top: 0, left: 1, bottom: 2, right: 3 });
    expect(summarizeRect(smallBoard(), toRect({ row: 1, col: 2 }, { row: 2, col: 3 }))).toEqual({ sum: 12, count: 3 });
  });

  it("합이 10이면 사과를 없애고 개수만큼 점수, 아니면 판이 그대로다", () => {
    const board = smallBoard();
    const hit = applySelection(board, toRect({ row: 0, col: 0 }, { row: 0, col: 1 })); // 1 + 9
    expect(hit.removed).toBe(2);
    expect(hit.board[0]).toEqual([0, 0, 5, 5]);
    expect(board[0]).toEqual([1, 9, 5, 5]); // 원래 판은 바뀌지 않는다

    const miss = applySelection(board, toRect({ row: 0, col: 0 }, { row: 1, col: 0 })); // 1 + 2
    expect(miss.removed).toBe(0);
    expect(miss.board).toBe(board);

    // 빈 자리(0)를 사이에 끼고도 남은 사과 합이 10이면 된다: 4 + 0 + 6
    expect(applySelection(board, toRect({ row: 2, col: 1 }, { row: 2, col: 3 })).removed).toBe(2);
  });
});
