/**
 * tetrisLogic.ts — 테트리스 게임 규칙 (화면과 분리한 순수 함수 + 리듀서)
 *
 * [판]
 *   가로 10칸 × 세로 20칸이 보이고, 그 위에 블록이 처음 나타나는 숨은 줄 2개가 더 있다(총 22줄).
 *   칸에는 비어 있으면 null, 쌓인 블록이면 블록 종류(I·O·T·S·Z·J·L, 색을 정할 때 쓴다)를 넣는다.
 *
 * [블록 = 작은 행렬]
 *   블록은 1이 채워진 칸인 정사각 행렬이다(I는 4×4, O는 2×2, 나머지는 3×3).
 *   회전은 행렬 돌리기: 시계 방향이면 rotated[r][c] = matrix[n-1-c][r].
 *   돌렸을 때 벽·블록에 걸리면 옆이나 위로 조금 옮겨 다시 시도한다(월 킥).
 *
 * [7-bag 무작위]
 *   7가지 블록을 한 자루(bag)에 넣어 섞고 차례로 꺼낸다. 다 꺼내면 새 자루. 같은 블록만 계속 나오는 불공평함을 막는 표준 방법이다.
 *   리듀서는 순수해야 하므로, 난수 상태(randomState)를 게임 상태에 넣어 두고 한 걸음씩(stepSeededRandom) 나아간다.
 *
 * [점수] 한 번에 지운 줄 1·2·3·4 → 100·300·500·800 × 레벨, 소프트 드롭 1칸 +1, 하드 드롭 1칸 +2.
 *        10줄마다 레벨이 오르고, 레벨이 오를수록 블록이 빨리 떨어진다.
 *
 * [바닥에 닿으면] 중력(TICK) 때 더 내려갈 수 없으면 그 자리에 굳는다(lock). 그래서 굳기 직전 한 박자 동안 옆으로 밀 수 있다.
 */
import { shuffle, stepSeededRandom, type RandomSource } from "@/features/games/shared/random";

export const BOARD_COLS = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 2;
export const BOARD_ROWS = VISIBLE_ROWS + HIDDEN_ROWS;

export type TetrominoType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const TETROMINO_TYPES: readonly TetrominoType[] = ["I", "O", "T", "S", "Z", "J", "L"];

export type Matrix = number[][];
/** 판의 칸: 블록 종류, 온라인 대전에서 받은 방해 줄("G" = garbage), 빈칸(null) */
export type BoardCell = TetrominoType | "G" | null;
export type TetrisBoard = BoardCell[][];
export type RotationDirection = "CW" | "CCW";
export type TetrisStatus = "READY" | "PLAYING" | "PAUSED" | "GAME_OVER";

/** 처음 나타날 때 모양(표준 SRS의 시작 방향) */
export const TETROMINO_SHAPES: Record<TetrominoType, Matrix> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

/** 한 번에 지운 줄 수(0~4)별 기본 점수. 실제 점수는 × 레벨 */
export const LINE_CLEAR_SCORES = [0, 100, 300, 500, 800] as const;
export const LINES_PER_LEVEL = 10;
/** 다음 블록 미리보기 개수 */
export const PREVIEW_COUNT = 3;

/** 회전이 막혔을 때 차례로 시도해 볼 위치 이동 [아래로(+)/위로(-) 줄, 오른쪽(+)/왼쪽(-) 칸] */
const ROTATION_KICKS: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, -1], [0, 1], [0, -2], [0, 2], [-1, 0], [-1, -1], [-1, 1]];

export interface ActivePiece {
  type: TetrominoType;
  matrix: Matrix;
  row: number; // 행렬 왼쪽 위 칸의 판 위치(숨은 줄 포함)
  col: number;
}

export interface TetrisState {
  board: TetrisBoard;
  active: ActivePiece | null;
  /** 다음에 나올 블록들(앞에서부터 꺼낸다). 항상 미리보기 개수보다 많게 채운다. */
  queue: TetrominoType[];
  hold: TetrominoType | null;
  /** 한 블록당 보관(hold)은 한 번만. 블록이 굳으면 다시 true */
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  status: TetrisStatus;
  /** 다음 7-bag을 섞을 난수 상태 */
  randomState: number;
  /** 방금 굳을 때 지운 줄 수(화면 알림용) */
  lastClearedLines: number;
  /** 지금까지 굳은 블록 수. 온라인 대전은 이 값이 바뀔 때마다 내 판을 서버에 보낸다 */
  pieceCount: number;
}

export type TetrisAction =
  | { type: "START"; seed: number }
  | { type: "MOVE"; offset: -1 | 1 }
  | { type: "ROTATE"; direction: RotationDirection }
  | { type: "SOFT_DROP" }
  | { type: "HARD_DROP" }
  | { type: "HOLD" }
  | { type: "TICK" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "PAUSE" } // 게임 중일 때만 멈춘다(포커스를 잃었을 때). 이미 멈췄으면 그대로
  | { type: "ADD_GARBAGE"; lines: number; holeCol: number } // 온라인 대전: 상대가 보낸 방해 줄(구멍 위치는 서버가 정한다)
  | { type: "END" }; // 온라인 대전: 판이 끝났으니(다른 사람이 이김) 내 게임도 멈춘다

export const createEmptyTetrisBoard = (): TetrisBoard => Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, (): BoardCell => null));

/** 행렬을 90도 돌린다(원본은 그대로). */
export const rotateMatrix = (matrix: Matrix, direction: RotationDirection): Matrix => {
  const size = matrix.length;
  return matrix.map((_, row) =>
    matrix.map((__, col) => (direction === "CW" ? matrix[size - 1 - col]?.[row] : matrix[col]?.[size - 1 - row]) ?? 0),
  );
};

/** 행렬의 채워진 칸이 판 밖(왼쪽·오른쪽·바닥·맨 위 바깥)이거나 쌓인 블록과 겹치는지 */
export const collides = (board: TetrisBoard, matrix: Matrix, row: number, col: number): boolean =>
  matrix.some((matrixRow, rowOffset) =>
    matrixRow.some((filled, colOffset) => {
      if (!filled) return false;
      const boardRow = row + rowOffset;
      const boardCol = col + colOffset;
      if (boardCol < 0 || boardCol >= BOARD_COLS || boardRow < 0 || boardRow >= BOARD_ROWS) return true;
      return board[boardRow]?.[boardCol] !== null;
    }),
  );

/** 블록을 처음 위치(가운데, 맨 위 숨은 줄)에 만든다. */
export const spawnPiece = (type: TetrominoType): ActivePiece => {
  const matrix = TETROMINO_SHAPES[type];
  return { type, matrix, row: 0, col: Math.floor((BOARD_COLS - (matrix[0]?.length ?? 0)) / 2) };
};

/** 지금 위치에서 바로 떨어뜨렸을 때 내려갈 수 있는 칸 수(하드 드롭·고스트 블록) */
export const dropDistance = (board: TetrisBoard, piece: ActivePiece): number => {
  let distance = 0;
  while (!collides(board, piece.matrix, piece.row + distance + 1, piece.col)) distance += 1;
  return distance;
};

/** 꽉 찬 줄을 지우고 위에 빈 줄을 채운다. */
export const clearLines = (board: TetrisBoard): { board: TetrisBoard; cleared: number } => {
  const remaining = board.filter((row) => row.some((cell) => cell === null));
  const cleared = board.length - remaining.length;
  const emptyRows = Array.from({ length: cleared }, () => Array.from({ length: BOARD_COLS }, (): BoardCell => null));
  return { board: [...emptyRows, ...remaining], cleared };
};

/** 블록을 판에 굳힌 새 판 */
export const mergePiece = (board: TetrisBoard, piece: ActivePiece): TetrisBoard =>
  board.map((row, rowIndex) =>
    row.map((cell, colIndex) => (piece.matrix[rowIndex - piece.row]?.[colIndex - piece.col] ? piece.type : cell)),
  );

/** 7가지 블록을 섞은 자루 하나와 다음 난수 상태 */
export const drawBag = (randomState: number): { bag: TetrominoType[]; randomState: number } => {
  let current = randomState;
  const random: RandomSource = () => {
    const step = stepSeededRandom(current);
    current = step.nextState;
    return step.value;
  };
  const bag = shuffle(TETROMINO_TYPES, random);
  return { bag, randomState: current };
};

/** 대기열이 미리보기 + 1개보다 짧으면 새 자루를 붙인다. */
const refillQueue = (queue: TetrominoType[], randomState: number): { queue: TetrominoType[]; randomState: number } => {
  let nextQueue = queue;
  let nextRandomState = randomState;
  while (nextQueue.length <= PREVIEW_COUNT) {
    const drawn = drawBag(nextRandomState);
    nextQueue = [...nextQueue, ...drawn.bag];
    nextRandomState = drawn.randomState;
  }
  return { queue: nextQueue, randomState: nextRandomState };
};

export const createTetrisState = (seed = 0): TetrisState => ({
  board: createEmptyTetrisBoard(),
  active: null,
  queue: [],
  hold: null,
  canHold: true,
  score: 0,
  lines: 0,
  level: 1,
  status: "READY",
  randomState: seed >>> 0,
  lastClearedLines: 0,
  pieceCount: 0,
});

/** 대기열에서 다음 블록을 꺼내 등장시킨다. 나올 자리가 막혀 있으면 게임 끝. */
const spawnNext = (state: TetrisState): TetrisState => {
  const refilled = refillQueue(state.queue, state.randomState);
  const [nextType, ...rest] = refilled.queue;
  if (!nextType) return { ...state, status: "GAME_OVER", active: null };
  const piece = spawnPiece(nextType);
  const base = { ...state, queue: rest, randomState: refilled.randomState };
  if (collides(state.board, piece.matrix, piece.row, piece.col)) return { ...base, active: null, status: "GAME_OVER" };
  return { ...base, active: piece };
};

/** 지금 블록을 굳히고, 줄을 지우고, 점수·레벨을 올린 뒤 다음 블록을 꺼낸다. */
const lockPiece = (state: TetrisState): TetrisState => {
  const { active } = state;
  if (!active) return state;
  const merged = mergePiece(state.board, active);
  // 블록이 통째로 숨은 줄(보이는 판 위)에서 굳으면 더 쌓을 곳이 없으므로 끝(lock out).
  const filledRows = active.matrix.flatMap((matrixRow, rowOffset) => (matrixRow.some(Boolean) ? [active.row + rowOffset] : []));
  if (filledRows.every((row) => row < HIDDEN_ROWS)) return { ...state, board: merged, active: null, status: "GAME_OVER" };

  const { board, cleared } = clearLines(merged);
  const lines = state.lines + cleared;
  const score = state.score + (LINE_CLEAR_SCORES[cleared] ?? 0) * state.level;
  const level = 1 + Math.floor(lines / LINES_PER_LEVEL);
  return spawnNext({ ...state, board, active: null, lines, score, level, canHold: true, lastClearedLines: cleared, pieceCount: state.pieceCount + 1 });
};

const moveActive = (state: TetrisState, rowOffset: number, colOffset: number): TetrisState | null => {
  const { active } = state;
  if (!active || collides(state.board, active.matrix, active.row + rowOffset, active.col + colOffset)) return null;
  return { ...state, active: { ...active, row: active.row + rowOffset, col: active.col + colOffset } };
};

const rotateActive = (state: TetrisState, direction: RotationDirection): TetrisState => {
  const { active } = state;
  if (!active || active.type === "O") return state; // O는 돌려도 모양이 같다
  const rotated = rotateMatrix(active.matrix, direction);
  for (const [rowKick, colKick] of ROTATION_KICKS) {
    if (!collides(state.board, rotated, active.row + rowKick, active.col + colKick)) {
      return { ...state, active: { ...active, matrix: rotated, row: active.row + rowKick, col: active.col + colKick } };
    }
  }
  return state; // 어떤 위치로도 돌릴 수 없으면 그대로
};

const holdActive = (state: TetrisState): TetrisState => {
  const { active } = state;
  if (!active || !state.canHold) return state;
  if (state.hold === null) return { ...spawnNext({ ...state, hold: active.type, active: null }), canHold: false };
  const piece = spawnPiece(state.hold);
  if (collides(state.board, piece.matrix, piece.row, piece.col)) return { ...state, status: "GAME_OVER", active: null };
  return { ...state, hold: active.type, active: piece, canHold: false };
};

/**
 * 방해 줄 받기(온라인 대전): 판을 위로 lines줄 밀어 올리고, 맨 아래에 구멍 한 칸짜리 회색 줄을 채운다.
 *   - 밀려서 판 맨 위 밖으로 나가는 줄에 블록이 있으면 끝(top out)
 *   - 떨어지던 블록이 새 줄과 겹치면 겹치지 않을 때까지 위로 올린다. 올릴 곳이 없으면 끝
 */
const addGarbage = (state: TetrisState, lines: number, holeCol: number): TetrisState => {
  if (lines <= 0 || (state.status !== "PLAYING" && state.status !== "PAUSED")) return state;
  const count = Math.min(Math.floor(lines), BOARD_ROWS);
  const hole = Math.min(BOARD_COLS - 1, Math.max(0, Math.floor(holeCol)));
  const garbageRow = (): BoardCell[] => Array.from({ length: BOARD_COLS }, (_, col): BoardCell => (col === hole ? null : "G"));
  const pushedOut = state.board.slice(0, count).some((row) => row.some(Boolean));
  const board = [...state.board.slice(count), ...Array.from({ length: count }, garbageRow)];
  if (pushedOut) return { ...state, board, active: null, status: "GAME_OVER" };
  const { active } = state;
  if (!active) return { ...state, board };
  let row = active.row;
  while (row >= 0 && collides(board, active.matrix, row, active.col)) row -= 1;
  if (row < 0) return { ...state, board, active: null, status: "GAME_OVER" };
  return { ...state, board, active: { ...active, row } };
};

export const tetrisReducer = (state: TetrisState, action: TetrisAction): TetrisState => {
  if (action.type === "START") {
    if (state.status === "PLAYING" || state.status === "PAUSED") return state;
    return spawnNext({ ...createTetrisState(action.seed), status: "PLAYING" });
  }
  if (action.type === "PAUSE") return state.status === "PLAYING" ? { ...state, status: "PAUSED" } : state;
  if (action.type === "END") return state.status === "PLAYING" || state.status === "PAUSED" ? { ...state, status: "GAME_OVER" } : state;
  if (action.type === "ADD_GARBAGE") return addGarbage(state, action.lines, action.holeCol);
  if (action.type === "TOGGLE_PAUSE") {
    if (state.status === "PLAYING") return { ...state, status: "PAUSED" };
    if (state.status === "PAUSED") return { ...state, status: "PLAYING" };
    return state;
  }
  if (state.status !== "PLAYING" || !state.active) return state; // 아래 동작은 게임 중에만

  switch (action.type) {
    case "MOVE":
      return moveActive(state, 0, action.offset) ?? state;
    case "ROTATE":
      return rotateActive(state, action.direction);
    case "SOFT_DROP": {
      const moved = moveActive(state, 1, 0);
      return moved ? { ...moved, score: moved.score + 1 } : lockPiece(state);
    }
    case "HARD_DROP": {
      const distance = dropDistance(state.board, state.active);
      return lockPiece({ ...state, active: { ...state.active, row: state.active.row + distance }, score: state.score + distance * 2 });
    }
    case "TICK":
      return moveActive(state, 1, 0) ?? lockPiece(state);
    case "HOLD":
      return holdActive(state);
  }
};

/** 레벨별 블록이 한 칸 떨어지는 시간(ms). 레벨이 오를수록 빨라지고 80ms보다 빨라지지는 않는다. */
export const gravityInterval = (level: number): number => Math.max(80, Math.round(800 * 0.85 ** (level - 1)));

/** 화면용: 보이는 20줄에 지금 블록과 고스트(떨어질 자리)를 겹친 판 */
export type DisplayCell = { type: TetrominoType | "G"; kind: "LOCKED" } | { type: TetrominoType; kind: "ACTIVE" | "GHOST" } | null;

export const createDisplayBoard = (state: TetrisState): DisplayCell[][] => {
  const display: DisplayCell[][] = state.board.map((row) => row.map((cell): DisplayCell => (cell ? { type: cell, kind: "LOCKED" } : null)));
  const { active } = state;
  if (active) {
    const ghostRow = active.row + dropDistance(state.board, active);
    const paint = (pieceRow: number, kind: "ACTIVE" | "GHOST"): void => {
      active.matrix.forEach((matrixRow, rowOffset) =>
        matrixRow.forEach((filled, colOffset) => {
          const row = display[pieceRow + rowOffset];
          if (!filled || !row) return;
          if (kind === "GHOST" && row[active.col + colOffset]) return; // 고스트는 빈 칸에만
          row[active.col + colOffset] = { type: active.type, kind };
        }),
      );
    };
    paint(ghostRow, "GHOST");
    paint(active.row, "ACTIVE");
  }
  return display.slice(HIDDEN_ROWS);
};

/** 실제 게임에서 START에 담을 시드 */
export const createTetrisSeed = (): number => Math.floor(Math.random() * 2 ** 32);
