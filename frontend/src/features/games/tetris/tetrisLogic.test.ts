import { describe, expect, it } from "vitest";
import {
  BOARD_COLS,
  BOARD_ROWS,
  clearLines,
  collides,
  createDisplayBoard,
  createEmptyTetrisBoard,
  createTetrisState,
  drawBag,
  dropDistance,
  gravityInterval,
  HIDDEN_ROWS,
  rotateMatrix,
  spawnPiece,
  TETROMINO_SHAPES,
  TETROMINO_TYPES,
  tetrisReducer,
  VISIBLE_ROWS,
  type TetrisAction,
  type TetrisBoard,
  type TetrisState,
  type TetrominoType,
} from "./tetrisLogic";

const run = (state: TetrisState, ...actions: TetrisAction[]): TetrisState => actions.reduce(tetrisReducer, state);
const started = (seed = 1): TetrisState => tetrisReducer(createTetrisState(), { type: "START", seed });

/** 원하는 블록을 원하는 판에서 바로 조작하도록 만든 상태 */
const withPiece = (type: TetrominoType, board: TetrisBoard = createEmptyTetrisBoard(), queue: TetrominoType[] = ["O", "O", "O", "O", "O"]): TetrisState => ({
  ...createTetrisState(),
  board,
  active: spawnPiece(type),
  queue,
  status: "PLAYING",
});

/** 아래쪽 n줄을 x칸만 비우고 채운 판 */
const boardWithFilledRows = (count: number, emptyCol: number): TetrisBoard =>
  createEmptyTetrisBoard().map((row, rowIndex) => (rowIndex >= BOARD_ROWS - count ? row.map((_, colIndex) => (colIndex === emptyCol ? null : "J")) : row));

describe("블록 회전·충돌", () => {
  it("시계 방향으로 네 번 돌리면 원래 모양, 반시계 한 번은 시계 세 번과 같다", () => {
    for (const type of TETROMINO_TYPES) {
      const shape = TETROMINO_SHAPES[type];
      const fourTimes = [1, 2, 3, 4].reduce((matrix) => rotateMatrix(matrix, "CW"), shape);
      expect(fourTimes).toEqual(shape);
      const threeTimes = [1, 2, 3].reduce((matrix) => rotateMatrix(matrix, "CW"), shape);
      expect(rotateMatrix(shape, "CCW")).toEqual(threeTimes);
    }
  });

  it("T를 시계 방향으로 돌린 모양", () => {
    expect(rotateMatrix(TETROMINO_SHAPES.T, "CW")).toEqual([[0, 1, 0], [0, 1, 1], [0, 1, 0]]);
  });

  it("벽·바닥 밖이나 쌓인 블록과 겹치면 충돌", () => {
    const board = createEmptyTetrisBoard();
    const o = TETROMINO_SHAPES.O;
    expect(collides(board, o, 0, -1)).toBe(true);
    expect(collides(board, o, 0, BOARD_COLS - 1)).toBe(true);
    expect(collides(board, o, BOARD_ROWS - 1, 0)).toBe(true);
    expect(collides(board, o, BOARD_ROWS - 2, 0)).toBe(false);
    const blocked = board.map((row, rowIndex) => (rowIndex === 5 ? row.map((_, colIndex) => (colIndex === 0 ? "I" : null)) : row));
    expect(collides(blocked, o, 4, 0)).toBe(true);
  });

  it("블록은 가운데 맨 위(숨은 줄)에 나타난다", () => {
    expect(spawnPiece("I")).toMatchObject({ row: 0, col: 3 });
    expect(spawnPiece("O")).toMatchObject({ row: 0, col: 4 });
    expect(spawnPiece("T")).toMatchObject({ row: 0, col: 3 });
  });
});

describe("줄 지우기", () => {
  it("꽉 찬 줄만 지우고 위에 빈 줄을 채운다", () => {
    const board = boardWithFilledRows(3, 0).map((row, rowIndex) => (rowIndex >= BOARD_ROWS - 2 ? row.map(() => "Z" as const) : row));
    const { board: cleared, cleared: count } = clearLines(board);
    expect(count).toBe(2);
    expect(cleared).toHaveLength(BOARD_ROWS);
    expect(cleared[BOARD_ROWS - 1]?.[0]).toBeNull(); // 지우지 않은 줄(0번 칸이 빈 줄)이 맨 아래로
    expect(cleared[BOARD_ROWS - 1]?.[1]).toBe("J");
    expect(cleared[0]?.every((cell) => cell === null)).toBe(true);
  });
});

describe("7-bag", () => {
  it("한 자루에는 7가지 블록이 정확히 하나씩", () => {
    const { bag } = drawBag(123);
    expect([...bag].sort()).toEqual([...TETROMINO_TYPES].sort());
  });

  it("게임 동안 나오는 블록은 7개씩 끊으면 언제나 7가지가 다 있다", () => {
    let state = started(77);
    const seen: TetrominoType[] = [];
    for (let count = 0; count < 21; count += 1) {
      if (state.active) seen.push(state.active.type);
      state = { ...run(state, { type: "HARD_DROP" }), board: createEmptyTetrisBoard() }; // 판이 차지 않게 비운다
    }
    for (let start = 0; start < 21; start += 7) {
      expect(new Set(seen.slice(start, start + 7)).size).toBe(7);
    }
  });

  it("같은 시드면 같은 순서", () => {
    expect(started(5).queue).toEqual(started(5).queue);
  });
});

describe("게임 진행(리듀서)", () => {
  it("시작하면 블록이 나오고 대기열이 미리보기보다 길다", () => {
    const state = started();
    expect(state.status).toBe("PLAYING");
    expect(state.active).not.toBeNull();
    expect(state.queue.length).toBeGreaterThan(3);
  });

  it("좌우 이동은 벽에서 멈춘다", () => {
    let state = withPiece("O");
    for (let count = 0; count < 10; count += 1) state = tetrisReducer(state, { type: "MOVE", offset: -1 });
    expect(state.active?.col).toBe(0);
    for (let count = 0; count < 10; count += 1) state = tetrisReducer(state, { type: "MOVE", offset: 1 });
    expect(state.active?.col).toBe(BOARD_COLS - 2);
  });

  it("벽에 붙은 I를 돌리면 벽 안쪽으로 밀어 넣어 돌린다(월 킥)", () => {
    let state = withPiece("I");
    state = run(state, { type: "ROTATE", direction: "CW" }, { type: "TICK" }, { type: "TICK" }); // 세로 I, 조금 내려 둔다
    for (let count = 0; count < 10; count += 1) state = tetrisReducer(state, { type: "MOVE", offset: 1 }); // 오른쪽 벽까지
    const rotated = tetrisReducer(state, { type: "ROTATE", direction: "CW" });
    expect(rotated.active?.matrix).not.toEqual(state.active?.matrix); // 돌아갔다
    expect(rotated.active && collides(rotated.board, rotated.active.matrix, rotated.active.row, rotated.active.col)).toBe(false);
  });

  it("O는 돌려도 그대로", () => {
    const state = withPiece("O");
    expect(tetrisReducer(state, { type: "ROTATE", direction: "CW" })).toBe(state);
  });

  it("소프트 드롭은 한 칸 +1점, 하드 드롭은 떨어진 칸 × 2점 후 바로 굳는다", () => {
    const soft = tetrisReducer(withPiece("O"), { type: "SOFT_DROP" });
    expect(soft.active?.row).toBe(1);
    expect(soft.score).toBe(1);
    const state = withPiece("O");
    const distance = state.active ? dropDistance(state.board, state.active) : 0;
    expect(distance).toBe(BOARD_ROWS - 2);
    const hard = tetrisReducer(state, { type: "HARD_DROP" });
    expect(hard.score).toBe(distance * 2);
    expect(hard.board[BOARD_ROWS - 1]?.slice(4, 6)).toEqual(["O", "O"]); // 바닥에 굳음
    expect(hard.active?.type).toBe("O"); // 다음 블록(대기열의 O)
  });

  it("중력(TICK): 내려갈 수 있으면 한 칸, 바닥이면 굳고 다음 블록", () => {
    let state = withPiece("O");
    state = tetrisReducer(state, { type: "TICK" });
    expect(state.active?.row).toBe(1);
    for (let count = 0; count < BOARD_ROWS; count += 1) state = tetrisReducer(state, { type: "TICK" });
    expect(state.board[BOARD_ROWS - 1]?.slice(4, 6)).toEqual(["O", "O"]);
  });

  it("줄을 지우면 줄 수 × 레벨 점수, 10줄마다 레벨 업", () => {
    // 아래 4줄이 0번 칸만 비어 있다 → 세로 I를 0번 칸에 떨어뜨리면 4줄(테트리스) 삭제
    let state = withPiece("I", boardWithFilledRows(4, 0));
    state = tetrisReducer(state, { type: "ROTATE", direction: "CW" }); // 세로 I: 행렬의 2번 열에 채워짐
    for (let count = 0; count < 10; count += 1) state = tetrisReducer(state, { type: "MOVE", offset: -1 });
    expect(state.active?.col).toBe(-2); // 행렬 왼쪽 두 열은 비어 있어 판 밖으로 나가도 된다
    const scored = tetrisReducer({ ...state, lines: 8, level: 1, score: 0 }, { type: "HARD_DROP" });
    expect(scored.lastClearedLines).toBe(4);
    expect(scored.lines).toBe(12);
    expect(scored.level).toBe(2);
    const dropDistanceScore = (BOARD_ROWS - 4) * 2; // 행 0에서 바닥(18~21줄)까지 18칸 × 2
    expect(scored.score).toBe(800 + dropDistanceScore);
    expect(scored.board.slice(BOARD_ROWS - 4).every((row) => row.every((cell) => cell === null))).toBe(true);
  });

  it("보관(hold): 비어 있으면 넣고 다음 블록, 한 블록당 한 번만, 굳으면 다시 가능", () => {
    let state = withPiece("T", createEmptyTetrisBoard(), ["S", "Z", "L", "J", "I"]);
    state = tetrisReducer(state, { type: "HOLD" });
    expect(state.hold).toBe("T");
    expect(state.active?.type).toBe("S");
    expect(tetrisReducer(state, { type: "HOLD" })).toBe(state); // 두 번은 안 됨
    state = tetrisReducer(state, { type: "HARD_DROP" }); // S가 굳으면
    expect(state.canHold).toBe(true);
    state = tetrisReducer(state, { type: "HOLD" }); // 지금 Z ↔ 보관된 T
    expect(state.active?.type).toBe("T");
    expect(state.hold).toBe("Z");
  });

  it("나올 자리가 막히면 게임 끝, 끝난 뒤에는 조작이 안 된다", () => {
    // 숨은 줄(1번)이 0번 칸만 빼고 막혀 있다(꽉 차면 줄이 지워지므로 한 칸 비움) → O가 굳은 뒤 다음 T가 나올 자리가 없다
    const blocked = createEmptyTetrisBoard().map((row, rowIndex) => (rowIndex === 1 ? row.map((_, colIndex) => (colIndex === 0 ? null : "Z")) : row));
    const state: TetrisState = { ...createTetrisState(), board: blocked, status: "PLAYING", active: { ...spawnPiece("O"), row: 5 }, queue: ["T", "T", "T", "T", "T"] };
    const over = tetrisReducer(state, { type: "HARD_DROP" });
    expect(over.status).toBe("GAME_OVER");
    expect(tetrisReducer(over, { type: "MOVE", offset: 1 })).toBe(over);
    expect(tetrisReducer(over, { type: "START", seed: 1 }).status).toBe("PLAYING"); // 새 게임은 가능
  });

  it("일시정지 중에는 중력·조작이 멈추고 다시 누르면 이어진다", () => {
    const paused = tetrisReducer(started(), { type: "TOGGLE_PAUSE" });
    expect(paused.status).toBe("PAUSED");
    expect(tetrisReducer(paused, { type: "TICK" })).toBe(paused);
    expect(tetrisReducer(paused, { type: "MOVE", offset: 1 })).toBe(paused);
    expect(tetrisReducer(paused, { type: "TOGGLE_PAUSE" }).status).toBe("PLAYING");
    // PAUSE는 멈추기만 한다: 이미 멈춘 게임·시작 전 게임은 그대로
    expect(tetrisReducer(started(), { type: "PAUSE" }).status).toBe("PAUSED");
    expect(tetrisReducer(paused, { type: "PAUSE" })).toBe(paused);
    const ready = createTetrisState();
    expect(tetrisReducer(ready, { type: "PAUSE" })).toBe(ready);
  });

  it("레벨이 오를수록 빨리 떨어지고 80ms보다 빨라지지 않는다", () => {
    expect(gravityInterval(1)).toBe(800);
    expect(gravityInterval(2)).toBeLessThan(800);
    expect(gravityInterval(50)).toBe(80);
  });
});

describe("화면용 판", () => {
  it("보이는 20줄만, 지금 블록과 고스트(떨어질 자리)를 겹쳐 보여 준다", () => {
    const display = createDisplayBoard({ ...withPiece("O"), active: { ...spawnPiece("O"), row: HIDDEN_ROWS } });
    expect(display).toHaveLength(VISIBLE_ROWS);
    expect(display[0]?.[4]).toEqual({ type: "O", kind: "ACTIVE" });
    expect(display[VISIBLE_ROWS - 1]?.[4]).toEqual({ type: "O", kind: "GHOST" });
  });
});

describe("온라인 대전용 규칙", () => {
  it("블록이 굳을 때마다 pieceCount가 1씩 는다", () => {
    const state = run(started(3), { type: "HARD_DROP" }, { type: "HARD_DROP" });
    expect(state.pieceCount).toBe(2);
  });

  it("방해 줄: 판을 위로 밀고 맨 아래에 구멍 한 칸짜리 회색 줄을 넣는다", () => {
    const state = tetrisReducer(withPiece("O"), { type: "ADD_GARBAGE", lines: 2, holeCol: 3 });
    const bottom = state.board[BOARD_ROWS - 1] ?? [];
    expect(bottom.filter((cell) => cell === "G")).toHaveLength(BOARD_COLS - 1);
    expect(bottom[3]).toBeNull();
    expect(state.board[BOARD_ROWS - 2]?.[3]).toBeNull();
    expect(state.board[BOARD_ROWS - 3]?.every((cell) => cell === null)).toBe(true);
    expect(state.board).toHaveLength(BOARD_ROWS);
    expect(state.status).toBe("PLAYING");
  });

  it("방해 줄 구멍에 세로 I를 넣으면 회색 줄도 지워진다", () => {
    let state = tetrisReducer(withPiece("I"), { type: "ADD_GARBAGE", lines: 4, holeCol: 0 });
    state = tetrisReducer(state, { type: "ROTATE", direction: "CW" });
    for (let count = 0; count < 10; count += 1) state = tetrisReducer(state, { type: "MOVE", offset: -1 });
    state = tetrisReducer(state, { type: "HARD_DROP" });
    expect(state.lastClearedLines).toBe(4);
    expect(state.board.flat().some((cell) => cell === "G")).toBe(false);
  });

  it("밀려 올라간 줄이 판 밖으로 나가거나 블록을 올릴 곳이 없으면 끝", () => {
    const full = createEmptyTetrisBoard().map((row, rowIndex) => (rowIndex < 3 ? row : row.map((_, colIndex) => (colIndex === 0 ? null : "J" as const))));
    const pushedOut = tetrisReducer({ ...withPiece("O", full), active: null }, { type: "ADD_GARBAGE", lines: 4, holeCol: 0 });
    expect(pushedOut.status).toBe("GAME_OVER");
  });

  it("떨어지던 블록과 새 줄이 겹치면 블록을 위로 올린다", () => {
    const state = tetrisReducer({ ...withPiece("O"), active: { ...spawnPiece("O"), row: BOARD_ROWS - 2 } }, { type: "ADD_GARBAGE", lines: 1, holeCol: 9 });
    expect(state.active?.row).toBe(BOARD_ROWS - 3);
    expect(state.status).toBe("PLAYING");
  });

  it("END: 진행 중이던 게임만 끝내고, 끝난 뒤의 방해 줄은 무시한다", () => {
    const ended = tetrisReducer(started(), { type: "END" });
    expect(ended.status).toBe("GAME_OVER");
    expect(tetrisReducer(ended, { type: "ADD_GARBAGE", lines: 2, holeCol: 0 })).toBe(ended);
    const ready = createTetrisState();
    expect(tetrisReducer(ready, { type: "END" })).toBe(ready);
  });

  it("화면용 판은 회색 줄도 LOCKED 칸으로 보여 준다", () => {
    const state = tetrisReducer(withPiece("O"), { type: "ADD_GARBAGE", lines: 1, holeCol: 0 });
    expect(createDisplayBoard(state)[VISIBLE_ROWS - 1]?.[1]).toEqual({ type: "G", kind: "LOCKED" });
  });
});
