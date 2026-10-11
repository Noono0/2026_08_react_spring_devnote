import { describe, expect, it } from "vitest";
import { createSeededRandom } from "@/features/games/shared/random";
import {
  addTile,
  canMove,
  createGame2048State,
  createInitialBoard,
  findEmptyCells,
  game2048Reducer,
  hasTile,
  highestTile,
  moveBoard,
  slideRow,
  transpose,
  type Board,
} from "./game2048Logic";

describe("한 줄 밀기(slideRow)", () => {
  it.each([
    [[0, 0, 0, 0], [0, 0, 0, 0], 0],
    [[2, 0, 0, 0], [2, 0, 0, 0], 0],
    [[0, 0, 0, 2], [2, 0, 0, 0], 0],
    [[2, 2, 0, 0], [4, 0, 0, 0], 4],
    [[2, 0, 2, 0], [4, 0, 0, 0], 4],
    [[2, 2, 2, 0], [4, 2, 0, 0], 4], // 앞에서부터 한 쌍만
    [[2, 2, 2, 2], [4, 4, 0, 0], 8], // 합친 타일은 다시 합치지 않음
    [[4, 4, 8, 0], [8, 8, 0, 0], 8], // 새로 만든 8과 원래 8은 이번 이동에서 합치지 않음
    [[2, 4, 8, 16], [2, 4, 8, 16], 0],
    [[4, 0, 4, 4], [8, 4, 0, 0], 8],
    [[1024, 1024, 0, 0], [2048, 0, 0, 0], 2048],
  ])("%j → %j (점수 +%i)", (input, expected, gained) => {
    expect(slideRow(input)).toEqual({ row: expected, gained });
  });

  it("원본 줄을 바꾸지 않는다(불변성)", () => {
    const row = [2, 2, 0, 0];
    slideRow(row);
    expect(row).toEqual([2, 2, 0, 0]);
  });
});

describe("판 전체 밀기(moveBoard)", () => {
  const board: Board = [
    [2, 0, 2, 0],
    [0, 4, 0, 4],
    [2, 2, 2, 2],
    [0, 0, 0, 8],
  ];

  it("왼쪽", () => {
    expect(moveBoard(board, "LEFT")).toEqual({ board: [[4, 0, 0, 0], [8, 0, 0, 0], [4, 4, 0, 0], [8, 0, 0, 0]], gained: 20, moved: true });
  });
  it("오른쪽: 오른쪽 끝부터 합친다", () => {
    expect(moveBoard(board, "RIGHT").board).toEqual([[0, 0, 0, 4], [0, 0, 0, 8], [0, 0, 4, 4], [0, 0, 0, 8]]);
  });
  it("위", () => {
    // 열마다 위로: [2,0,2,0]→[4,0,0,0], [0,4,2,0]→[4,2,0,0], [2,0,2,0]→[4,0,0,0], [0,4,2,8]→[4,2,8,0]
    expect(moveBoard(board, "UP").board).toEqual([[4, 4, 4, 4], [0, 2, 0, 2], [0, 0, 0, 8], [0, 0, 0, 0]]);
  });
  it("아래: 아래 끝부터 합친다", () => {
    expect(moveBoard(board, "DOWN").board).toEqual([[0, 0, 0, 0], [0, 0, 0, 4], [0, 4, 0, 2], [4, 2, 4, 8]]);
  });
  it("아무것도 안 바뀌면 moved는 false", () => {
    expect(moveBoard([[2, 4, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], "LEFT").moved).toBe(false);
  });
  it("transpose 두 번이면 원래대로", () => {
    expect(transpose(transpose(board))).toEqual(board);
  });
});

describe("새 타일·움직임 판정", () => {
  it("빈칸 중 cellRandom 위치에 놓고, valueRandom < 0.9면 2, 아니면 4", () => {
    const empty: Board = [[2, 0], [0, 4]];
    expect(addTile(empty, 0, 0.5)).toEqual({ board: [[2, 2], [0, 4]], added: { row: 0, col: 1 } });
    expect(addTile(empty, 0.99, 0.95)).toEqual({ board: [[2, 0], [4, 4]], added: { row: 1, col: 0 } });
    expect(empty).toEqual([[2, 0], [0, 4]]);
  });

  it("빈칸이 없으면 판 그대로", () => {
    const full: Board = [[2, 4], [8, 16]];
    expect(addTile(full, 0.3, 0.3)).toEqual({ board: full, added: null });
  });

  it("빈칸이나 이웃한 같은 수가 있으면 움직일 수 있다", () => {
    expect(canMove([[2, 4], [8, 0]])).toBe(true);
    expect(canMove([[2, 2], [8, 16]])).toBe(true); // 가로 이웃
    expect(canMove([[2, 4], [2, 16]])).toBe(true); // 세로 이웃
    expect(canMove([[2, 4], [8, 16]])).toBe(false);
  });

  it("새 게임 판에는 타일이 정확히 두 개(2 또는 4)", () => {
    const board = createInitialBoard(createSeededRandom(5));
    const tiles = board.flat().filter((value) => value !== 0);
    expect(tiles).toHaveLength(2);
    expect(tiles.every((value) => value === 2 || value === 4)).toBe(true);
    expect(findEmptyCells(board)).toHaveLength(14);
  });
});

describe("게임 진행(리듀서)", () => {
  const start = (board: Board) => createGame2048State(board);

  it("움직이면 점수가 오르고 새 타일이 하나 생긴다", () => {
    const state = game2048Reducer(start([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), { type: "MOVE", direction: "LEFT", randomValues: [0, 0] });
    expect(state.score).toBe(4);
    expect(state.board).toEqual([[4, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(state.addedTile).toEqual({ row: 0, col: 1 });
    expect(state.moveCount).toBe(1);
  });

  it("판이 그대로인 이동은 아무 일도 없다(같은 객체)", () => {
    const state = start([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(game2048Reducer(state, { type: "MOVE", direction: "LEFT", randomValues: [0, 0] })).toBe(state);
  });

  it("2048을 만들면 승리 → 계속하기 전에는 움직이지 않고, 계속하면 다시 승리 화면 없이 진행", () => {
    const won = game2048Reducer(start([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), { type: "MOVE", direction: "LEFT", randomValues: [0.5, 0] });
    expect(won.status).toBe("WON");
    expect(hasTile(won.board, 2048)).toBe(true);
    expect(game2048Reducer(won, { type: "MOVE", direction: "RIGHT", randomValues: [0, 0] })).toBe(won);
    const continued = game2048Reducer(won, { type: "CONTINUE" });
    expect(continued).toMatchObject({ status: "PLAYING", keepPlaying: true });
    const afterMove = game2048Reducer(continued, { type: "MOVE", direction: "RIGHT", randomValues: [0, 0] });
    expect(afterMove.status).toBe("PLAYING");
  });

  it("더 움직일 수 없게 되면 끝", () => {
    // 왼쪽으로 밀면 2,2가 합쳐지고, 새 타일(2)이 마지막 빈칸을 채워 더 움직일 수 없게 된다.
    const nearlyFull: Board = [[2, 2, 4, 8], [4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 128]];
    const lost = game2048Reducer(start(nearlyFull), { type: "MOVE", direction: "LEFT", randomValues: [0, 0] });
    expect(lost.board[0]).toEqual([4, 4, 8, 2]);
    expect(canMove(lost.board)).toBe(true); // 4,4가 이웃이라 아직 움직일 수 있음
    expect(lost.status).toBe("PLAYING");
    const stuck = start([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
    expect(stuck.status).toBe("LOST");
    expect(game2048Reducer(stuck, { type: "MOVE", direction: "LEFT", randomValues: [0, 0] })).toBe(stuck);
  });

  it("다시 시작하면 점수 0, 새 판", () => {
    const board = createInitialBoard(createSeededRandom(9));
    const restarted = game2048Reducer({ ...start(board), score: 500 }, { type: "RESTART", board });
    expect(restarted).toMatchObject({ score: 0, status: "PLAYING", keepPlaying: false, moveCount: 0 });
    expect(highestTile(restarted.board)).toBeLessThanOrEqual(4);
  });
});
