/**
 * game2048Logic.ts — 2048 게임 규칙 (화면과 분리한 순수 함수 + 리듀서)
 *
 * [규칙]
 *   4×4 판의 모든 타일을 한 방향으로 민다. 같은 숫자가 부딪치면 합쳐져 두 배가 되고, 합친 숫자만큼 점수가 오른다.
 *   한 번 합쳐진 타일은 그 이동에서 다시 합쳐지지 않는다. ([2,2,2,2] → [4,4,0,0], [8,0,0,0]이 아님)
 *   판이 실제로 바뀐 이동 뒤에만 빈칸 하나에 새 타일(90% 2, 10% 4)이 생긴다.
 *   목표 타일(기본 2048, 연습에서는 방장이 고른 256~2048)을 만들면 승리(계속하기 가능), 더 움직일 수 없으면 끝.
 *
 * [핵심 아이디어: 한 줄만 제대로 만들면 된다]
 *   slideRow는 "한 줄을 왼쪽으로 밀기"만 한다. 오른쪽·위·아래는 판을 뒤집거나(reverse) 행·열을 바꿔(transpose)
 *   왼쪽 밀기로 만든 뒤 다시 되돌린다. 복잡한 규칙을 작은 순수 함수 하나로 줄이는 연습이다.
 *
 * ★ 리듀서는 순수해야 하므로 새 타일 위치·숫자에 쓸 무작위 값은 MOVE 동작에 담아 보낸다(randomValues).
 *   그래서 같은 동작이면 언제나 같은 결과가 나오고, 테스트에서 원하는 값을 넣어 확인할 수 있다.
 */
import type { RandomSource } from "@/features/games/shared/random";

export const BOARD_SIZE = 4;
export const WIN_VALUE = 2048;

export type Board = number[][]; // 0 = 빈칸
export type Direction = "LEFT" | "RIGHT" | "UP" | "DOWN";
export type Game2048Status = "PLAYING" | "WON" | "LOST";

export interface Position {
  row: number;
  col: number;
}

/** 한 줄 밀기 결과: 민 줄과 이번에 합쳐서 얻은 점수 */
export interface SlideResult {
  row: number[];
  gained: number;
}

/**
 * 한 줄을 왼쪽으로 민다.
 *   1) 0(빈칸)을 빼고 숫자만 모은다.        [2,0,2,4] → [2,2,4]
 *   2) 앞에서부터 같은 두 수를 한 번씩 합친다. [2,2,4] → [4,4]  (합친 수는 다음 수와 다시 합치지 않는다)
 *   3) 원래 길이만큼 뒤를 0으로 채운다.       [4,4]   → [4,4,0,0]
 */
export const slideRow = (row: readonly number[]): SlideResult => {
  const tiles = row.filter((value) => value !== 0);
  const slid: number[] = [];
  let gained = 0;
  for (let index = 0; index < tiles.length; index += 1) {
    const current = tiles[index] ?? 0;
    const next = tiles[index + 1];
    if (next !== undefined && next === current) {
      slid.push(current * 2);
      gained += current * 2;
      index += 1; // 합친 다음 칸은 건너뛴다(한 번만 합쳐지게)
    } else {
      slid.push(current);
    }
  }
  while (slid.length < row.length) slid.push(0);
  return { row: slid, gained };
};

/** 행과 열을 바꾼다(대각선 기준으로 뒤집기). 위·아래 이동을 왼쪽·오른쪽 이동처럼 다루려고 쓴다. */
export const transpose = (board: Board): Board => (board[0] ?? []).map((_, col) => board.map((row) => row[col] ?? 0));

const reverseRows = (board: Board): Board => board.map((row) => [...row].reverse());

export const boardsEqual = (left: Board, right: Board): boolean =>
  left.length === right.length && left.every((row, rowIndex) => row.every((value, colIndex) => value === right[rowIndex]?.[colIndex]));

export interface MoveResult {
  board: Board;
  gained: number;
  moved: boolean;
}

/** 판 전체를 한 방향으로 민다. 모든 방향을 "왼쪽 밀기"로 바꿔 처리한다. */
export const moveBoard = (board: Board, direction: Direction): MoveResult => {
  const slideAllLeft = (target: Board): { board: Board; gained: number } => {
    let gained = 0;
    const slid = target.map((row) => {
      const result = slideRow(row);
      gained += result.gained;
      return result.row;
    });
    return { board: slid, gained };
  };

  let result: { board: Board; gained: number };
  if (direction === "LEFT") result = slideAllLeft(board);
  else if (direction === "RIGHT") {
    const slid = slideAllLeft(reverseRows(board));
    result = { board: reverseRows(slid.board), gained: slid.gained };
  } else if (direction === "UP") {
    const slid = slideAllLeft(transpose(board));
    result = { board: transpose(slid.board), gained: slid.gained };
  } else {
    const slid = slideAllLeft(reverseRows(transpose(board)));
    result = { board: transpose(reverseRows(slid.board)), gained: slid.gained };
  }
  return { ...result, moved: !boardsEqual(board, result.board) };
};

export const createEmptyBoard = (size = BOARD_SIZE): Board => Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

export const findEmptyCells = (board: Board): Position[] =>
  board.flatMap((row, rowIndex) => row.flatMap((value, colIndex) => (value === 0 ? [{ row: rowIndex, col: colIndex }] : [])));

/**
 * 빈칸 하나에 새 타일을 놓는다(원본은 그대로, 새 판을 돌려준다).
 *   cellRandom  : 0~1 → 빈칸 중 몇 번째에 놓을지
 *   valueRandom : 0~1 → 0.9 미만이면 2, 아니면 4
 * 빈칸이 없으면 판을 그대로 돌려준다.
 */
export const addTile = (board: Board, cellRandom: number, valueRandom: number): { board: Board; added: Position | null } => {
  const emptyCells = findEmptyCells(board);
  const target = emptyCells[Math.min(emptyCells.length - 1, Math.floor(cellRandom * emptyCells.length))];
  if (!target) return { board, added: null };
  const value = valueRandom < 0.9 ? 2 : 4;
  const next = board.map((row, rowIndex) => (rowIndex === target.row ? row.map((cell, colIndex) => (colIndex === target.col ? value : cell)) : row));
  return { board: next, added: target };
};

/** 빈칸이 있거나, 가로·세로로 이웃한 같은 숫자가 있으면 아직 움직일 수 있다. */
export const canMove = (board: Board): boolean =>
  board.some((row, rowIndex) =>
    row.some((value, colIndex) => value === 0 || value === row[colIndex + 1] || value === board[rowIndex + 1]?.[colIndex]),
  );

export const hasTile = (board: Board, value: number): boolean => board.some((row) => row.includes(value));

export interface Game2048State {
  board: Board;
  score: number;
  status: Game2048Status;
  /** 이 타일을 만들면 승리(WON) */
  target: number;
  /** 목표 타일을 만든 뒤 "계속하기"를 골랐는지(그 뒤로는 다시 승리 화면을 띄우지 않는다) */
  keepPlaying: boolean;
  /** 방금 생긴 타일 위치(화면에서 나타나는 효과에 쓴다) */
  addedTile: Position | null;
  /** 이동 횟수(같은 판이어도 이동마다 타일 효과를 다시 주려고 key에 쓴다) */
  moveCount: number;
}

export type Game2048Action =
  | { type: "MOVE"; direction: Direction; randomValues: [number, number] }
  | { type: "CONTINUE" }
  /** target을 주면 그 목표로, 없으면 지금 목표 그대로 새 판 */
  | { type: "RESTART"; board: Board; target?: number };

/** 새 게임 판: 빈 판에 타일 두 개 */
export const createInitialBoard = (random: RandomSource): Board => {
  const first = addTile(createEmptyBoard(), random(), random());
  return addTile(first.board, random(), random()).board;
};

export const createGame2048State = (board: Board, target = WIN_VALUE): Game2048State => ({
  board,
  score: 0,
  status: canMove(board) ? "PLAYING" : "LOST",
  target,
  keepPlaying: false,
  addedTile: null,
  moveCount: 0,
});

export const game2048Reducer = (state: Game2048State, action: Game2048Action): Game2048State => {
  switch (action.type) {
    case "MOVE": {
      // 끝났거나, 목표 타일을 만들고 "계속하기"를 고르기 전이면 움직이지 않는다.
      if (state.status === "LOST" || state.status === "WON") return state;
      const moved = moveBoard(state.board, action.direction);
      if (!moved.moved) return state; // 판이 그대로면 새 타일도 생기지 않는다
      const [cellRandom, valueRandom] = action.randomValues;
      const withTile = addTile(moved.board, cellRandom, valueRandom);
      const reachedGoal = !state.keepPlaying && highestTile(withTile.board) >= state.target;
      const status: Game2048Status = reachedGoal ? "WON" : canMove(withTile.board) ? "PLAYING" : "LOST";
      return { ...state, board: withTile.board, score: state.score + moved.gained, status, addedTile: withTile.added, moveCount: state.moveCount + 1 };
    }
    case "CONTINUE":
      return state.status === "WON" ? { ...state, status: canMove(state.board) ? "PLAYING" : "LOST", keepPlaying: true } : state;
    case "RESTART":
      return createGame2048State(action.board, action.target ?? state.target);
  }
};

/** 실제 게임에서 MOVE에 담을 무작위 값 두 개 */
export const createMoveRandomValues = (random: RandomSource): [number, number] => [random(), random()];

/** 판에서 가장 큰 타일 */
export const highestTile = (board: Board): number => Math.max(0, ...board.flat());
