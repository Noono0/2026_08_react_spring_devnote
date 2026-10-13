/**
 * puyoLogic.ts — 뿌요뿌요 규칙 (화면과 분리한 순수 함수 + 리듀서)
 *
 * [판]
 *   가로 6칸 × 세로 12칸이 보이고, 그 위에 뿌요가 처음 나타나는 숨은 줄 1개가 더 있다(총 13줄).
 *   칸에는 색 뿌요(R·G·B·Y·P), 방해 뿌요(N = nuisance/ojama), 빈칸(null)을 넣는다.
 *
 * [한 쌍]
 *   축(axis)과 자식(child) 두 개. 회전 0=위, 1=오른쪽, 2=아래, 3=왼쪽. 벽에 걸리면 옆으로 한 칸 민다.
 *
 * [지움]
 *   같은 색이 상하좌우로 4개 이상 이어지면 터지고, 붙어 있는 방해 뿌요도 같이 사라진다.
 *   중력으로 떨어진 뒤 또 4개가 모이면 연쇄. 점수는 간단한 츠(Tsu) 규칙(10 × 개수 × 배율).
 *
 * [방해]
 *   이번 굳히기에서 얻은 점수 ÷ 70(내림)만큼 상대에게 보낸다. 받은 방해는 쌓아 두었다가 내 쌍이 굳은 뒤에 떨어진다.
 *
 * [무작위]
 *   리듀서 안에서 Math.random을 쓰지 않는다. 시드와 randomState를 상태에 두고 stepSeededRandom으로 한 걸음씩 나아간다.
 *   같은 시드면 같은 순서의 쌍이 나온다(온라인 대전에서 모두가 같은 큐를 받는 이유).
 */
import { stepSeededRandom } from "@/features/games/shared/random";

export const PUYO_COLS = 6;
export const PUYO_VISIBLE_ROWS = 12;
export const PUYO_HIDDEN_ROWS = 1;
export const PUYO_ROWS = PUYO_VISIBLE_ROWS + PUYO_HIDDEN_ROWS;
export const POP_SIZE = 4;
export const PREVIEW_COUNT = 2;
export const NUISANCE_SCORE = 70;
export const MAX_NUISANCE_PER_LOCK = 30;
export const PUYO_BOARD_TEXT_LENGTH = PUYO_VISIBLE_ROWS * PUYO_COLS;

export type ColorPuyo = "R" | "G" | "B" | "Y" | "P";
export type PuyoCell = ColorPuyo | "N" | null;
export type PuyoBoard = PuyoCell[][];
export type ColorCount = 3 | 4 | 5;
export type PairRotation = 0 | 1 | 2 | 3;
export type RotationDirection = "CW" | "CCW";
export type PuyoStatus = "READY" | "PLAYING" | "PAUSED" | "GAME_OVER";

export const COLOR_COUNTS = [3, 4, 5] as const;
export const COLORS_BY_COUNT: Record<ColorCount, readonly ColorPuyo[]> = {
  3: ["R", "G", "B"],
  4: ["R", "G", "B", "Y"],
  5: ["R", "G", "B", "Y", "P"],
};

const SPAWN_ROW = 1;
const SPAWN_COL = 2;
const CHILD_OFFSET: Record<PairRotation, readonly [number, number]> = {
  0: [-1, 0],
  1: [0, 1],
  2: [1, 0],
  3: [0, -1],
};
const ROTATION_KICKS: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, -1], [0, 1], [1, 0], [0, -2], [0, 2]];

const cellAt = (board: PuyoBoard, row: number, col: number): PuyoCell => board[row]?.[col] ?? null;

const writeCell = (board: PuyoBoard, row: number, col: number, value: PuyoCell): void => {
  const target = board[row];
  if (target) target[col] = value;
};
const CHAIN_POWER = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512] as const;
const COLOR_BONUS = [0, 0, 3, 6, 12, 24] as const;

export interface PairSpec {
  axis: ColorPuyo;
  child: ColorPuyo;
}

export interface ActivePair extends PairSpec {
  row: number;
  col: number;
  rotation: PairRotation;
}

export interface PairCell {
  row: number;
  col: number;
  color: ColorPuyo;
}

export interface PuyoGroup {
  color: ColorPuyo;
  cells: ReadonlyArray<readonly [number, number]>;
}

export type DisplayKind = "PLACED" | "ACTIVE" | "GHOST";
export interface DisplayCell {
  color: Exclude<PuyoCell, null>;
  kind: DisplayKind;
}

export interface PuyoState {
  board: PuyoBoard;
  active: ActivePair | null;
  queue: PairSpec[];
  status: PuyoStatus;
  score: number;
  /** 이번 판에서 일어난 연쇄 횟수 합 */
  chains: number;
  /** 한 번에 이어진 최대 연쇄 */
  maxChain: number;
  lastChain: number;
  /** 방금 굳힌 뒤 상대에게 보낼 방해 개수(온라인 대전이 이 값으로 공격한다) */
  lastNuisance: number;
  pendingNuisance: number;
  colorCount: ColorCount;
  seed: number;
  randomState: number;
  /** 나온 쌍 수. 온라인 대전에서 "새 쌍이 나왔으니 판을 보낸다"를 구분한다 */
  pairCount: number;
}

export type PuyoAction =
  | { type: "START"; seed: number; colorCount?: ColorCount }
  | { type: "MOVE"; offset: -1 | 1 }
  | { type: "ROTATE"; direction: RotationDirection }
  | { type: "SOFT_DROP" }
  | { type: "HARD_DROP" }
  | { type: "TICK" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "PAUSE" }
  | { type: "ADD_GARBAGE"; count: number }
  | { type: "END" };

export const createEmptyPuyoBoard = (): PuyoBoard =>
  Array.from({ length: PUYO_ROWS }, () => Array.from({ length: PUYO_COLS }, (): PuyoCell => null));

export const createPuyoState = (): PuyoState => ({
  board: createEmptyPuyoBoard(),
  active: null,
  queue: [],
  status: "READY",
  score: 0,
  chains: 0,
  maxChain: 0,
  lastChain: 0,
  lastNuisance: 0,
  pendingNuisance: 0,
  colorCount: 4,
  seed: 0,
  randomState: 0,
  pairCount: 0,
});

export const createPuyoSeed = (): number => Math.floor(Math.random() * 2 ** 32);

export const parseColorCount = (value: string | null | undefined): ColorCount =>
  value === "3" || value === "5" ? Number(value) as ColorCount : 4;

export const childOffset = (rotation: PairRotation): readonly [number, number] => CHILD_OFFSET[rotation];

export const pairCells = (pair: ActivePair): [PairCell, PairCell] => {
  const [deltaRow, deltaCol] = childOffset(pair.rotation);
  return [
    { row: pair.row, col: pair.col, color: pair.axis },
    { row: pair.row + deltaRow, col: pair.col + deltaCol, color: pair.child },
  ];
};

export const collides = (board: PuyoBoard, pair: ActivePair): boolean => {
  for (const cell of pairCells(pair)) {
    if (cell.col < 0 || cell.col >= PUYO_COLS || cell.row >= PUYO_ROWS) return true;
    if (cell.row < 0) continue;
    if (cellAt(board, cell.row, cell.col) !== null) return true;
  }
  return false;
};

export const dropDistance = (board: PuyoBoard, pair: ActivePair): number => {
  let distance = 0;
  let next = { ...pair, row: pair.row + 1 };
  while (!collides(board, next)) {
    distance += 1;
    next = { ...next, row: next.row + 1 };
  }
  return distance;
};

export const applyGravity = (board: PuyoBoard): PuyoBoard => {
  const next = createEmptyPuyoBoard();
  for (let col = 0; col < PUYO_COLS; col += 1) {
    const falling: Exclude<PuyoCell, null>[] = [];
    for (let row = 0; row < PUYO_ROWS; row += 1) {
      const cell = cellAt(board, row, col);
      if (cell !== null) falling.push(cell);
    }
    let writeRow = PUYO_ROWS - falling.length;
    for (const cell of falling) {
      writeCell(next, writeRow, col, cell);
      writeRow += 1;
    }
  }
  return next;
};

const neighbors = (row: number, col: number): Array<readonly [number, number]> => {
  const cells: Array<readonly [number, number]> = [];
  if (row > 0) cells.push([row - 1, col]);
  if (row + 1 < PUYO_ROWS) cells.push([row + 1, col]);
  if (col > 0) cells.push([row, col - 1]);
  if (col + 1 < PUYO_COLS) cells.push([row, col + 1]);
  return cells;
};

export const findPopGroups = (board: PuyoBoard): PuyoGroup[] => {
  const seen = new Set<string>();
  const groups: PuyoGroup[] = [];
  const keyOf = (row: number, col: number) => `${row},${col}`;
  for (let row = 0; row < PUYO_ROWS; row += 1) {
    for (let col = 0; col < PUYO_COLS; col += 1) {
      const color = cellAt(board, row, col);
      if (color === null || color === "N" || seen.has(keyOf(row, col))) continue;
      const cells: Array<readonly [number, number]> = [];
      const stack: Array<readonly [number, number]> = [[row, col]];
      seen.add(keyOf(row, col));
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) break;
        const [hereRow, hereCol] = current;
        cells.push([hereRow, hereCol]);
        for (const [nextRow, nextCol] of neighbors(hereRow, hereCol)) {
          if (seen.has(keyOf(nextRow, nextCol)) || cellAt(board, nextRow, nextCol) !== color) continue;
          seen.add(keyOf(nextRow, nextCol));
          stack.push([nextRow, nextCol]);
        }
      }
      if (cells.length >= POP_SIZE) groups.push({ color, cells });
    }
  }
  return groups;
};

const groupBonus = (size: number): number => {
  if (size <= 4) return 0;
  if (size >= 11) return 10;
  return size - 3;
};

export const chainScore = (chainIndex: number, groups: PuyoGroup[]): number => {
  const puyos = groups.reduce((sum, group) => sum + group.cells.length, 0);
  const uniqueColors = new Set(groups.map((group) => group.color)).size;
  const power = CHAIN_POWER[Math.min(chainIndex - 1, CHAIN_POWER.length - 1)] ?? 0;
  const colorBonus = COLOR_BONUS[Math.min(uniqueColors, COLOR_BONUS.length - 1)] ?? 0;
  const groupsBonus = groups.reduce((sum, group) => sum + groupBonus(group.cells.length), 0);
  return 10 * puyos * Math.max(1, power + colorBonus + groupsBonus);
};

export const resolveChains = (board: PuyoBoard): { board: PuyoBoard; chain: number; score: number } => {
  let current = board;
  let chain = 0;
  let score = 0;
  for (;;) {
    const groups = findPopGroups(current);
    if (groups.length === 0) break;
    chain += 1;
    score += chainScore(chain, groups);
    const next = current.map((row) => [...row]);
    const popping = new Set<string>();
    for (const group of groups) {
      for (const [row, col] of group.cells) popping.add(`${row},${col}`);
    }
    for (const key of [...popping]) {
      const [rowText, colText] = key.split(",");
      const row = Number(rowText);
      const col = Number(colText);
      for (const [nextRow, nextCol] of neighbors(row, col)) {
        if (cellAt(next, nextRow, nextCol) === "N") popping.add(`${nextRow},${nextCol}`);
      }
    }
    for (const key of popping) {
      const [rowText, colText] = key.split(",");
      writeCell(next, Number(rowText), Number(colText), null);
    }
    current = applyGravity(next);
  }
  return { board: current, chain, score };
};

export const nuisanceForScore = (score: number): number =>
  Math.min(MAX_NUISANCE_PER_LOCK, Math.floor(Math.max(0, score) / NUISANCE_SCORE));

/** 빈 칸을 아래부터 왼쪽→오른쪽으로 채운다. 가득 찬 열은 건너뛰고, 남은 개수는 remaining으로 돌려준다. */
export const dropNuisance = (board: PuyoBoard, count: number): { board: PuyoBoard; remaining: number } => {
  if (count <= 0) return { board, remaining: 0 };
  const next = board.map((row) => [...row]);
  let remaining = count;
  let col = 0;
  let idleRounds = 0;
  while (remaining > 0 && idleRounds < PUYO_COLS) {
    let placed = false;
    for (let row = PUYO_ROWS - 1; row >= 0; row -= 1) {
      if (cellAt(next, row, col) === null) {
        writeCell(next, row, col, "N");
        remaining -= 1;
        placed = true;
        break;
      }
    }
    idleRounds = placed ? 0 : idleRounds + 1;
    col = (col + 1) % PUYO_COLS;
  }
  return { board: next, remaining };
};

export const toBoardText = (board: PuyoBoard): string =>
  board.slice(PUYO_HIDDEN_ROWS).map((row) => row.map((cell) => cell ?? ".").join("")).join("");

export const gravityInterval = (maxChain: number): number => Math.max(140, Math.round(720 * 0.92 ** maxChain));

const nextRotation = (rotation: PairRotation, direction: RotationDirection): PairRotation =>
  ((rotation + (direction === "CW" ? 1 : 3)) % 4) as PairRotation;

const tryRotate = (board: PuyoBoard, pair: ActivePair, direction: RotationDirection): ActivePair | null => {
  const rotated = { ...pair, rotation: nextRotation(pair.rotation, direction) };
  for (const [deltaRow, deltaCol] of ROTATION_KICKS) {
    const candidate = { ...rotated, row: pair.row + deltaRow, col: pair.col + deltaCol };
    if (!collides(board, candidate)) return candidate;
  }
  return null;
};

const drawPair = (randomState: number, colors: readonly ColorPuyo[]): { spec: PairSpec; randomState: number } => {
  const axisRoll = stepSeededRandom(randomState);
  const childRoll = stepSeededRandom(axisRoll.nextState);
  const pick = (roll: number): ColorPuyo => colors[Math.min(colors.length - 1, Math.floor(roll * colors.length))] ?? "R";
  const axis = pick(axisRoll.value);
  const child = pick(childRoll.value);
  return { spec: { axis, child }, randomState: childRoll.nextState };
};

const fillQueue = (state: PuyoState): PuyoState => {
  const colors = COLORS_BY_COUNT[state.colorCount];
  const queue = [...state.queue];
  let randomState = state.randomState;
  while (queue.length < PREVIEW_COUNT) {
    const drawn = drawPair(randomState, colors);
    queue.push(drawn.spec);
    randomState = drawn.randomState;
  }
  return { ...state, queue, randomState };
};

const spawn = (state: PuyoState): PuyoState => {
  const filled = fillQueue(state);
  const spec = filled.queue[0];
  if (!spec) return { ...filled, active: null, status: "GAME_OVER" };
  const active: ActivePair = { ...spec, row: SPAWN_ROW, col: SPAWN_COL, rotation: 0 };
  if (collides(filled.board, active)) {
    return { ...filled, active: null, status: "GAME_OVER" };
  }
  return { ...filled, active, queue: filled.queue.slice(1), pairCount: filled.pairCount + 1 };
};

const placePair = (board: PuyoBoard, pair: ActivePair): PuyoBoard => {
  const next = board.map((row) => [...row]);
  for (const cell of pairCells(pair)) {
    if (cell.row >= 0 && cell.row < PUYO_ROWS && cell.col >= 0 && cell.col < PUYO_COLS) {
      writeCell(next, cell.row, cell.col, cell.color);
    }
  }
  return next;
};

const lockPair = (state: PuyoState): PuyoState => {
  if (!state.active) return state;
  const placed = applyGravity(placePair(state.board, state.active));
  const resolved = resolveChains(placed);
  const dropped = dropNuisance(resolved.board, state.pendingNuisance);
  const next: PuyoState = {
    ...state,
    board: dropped.board,
    active: null,
    score: state.score + resolved.score,
    chains: state.chains + resolved.chain,
    maxChain: Math.max(state.maxChain, resolved.chain),
    lastChain: resolved.chain,
    lastNuisance: nuisanceForScore(resolved.score),
    pendingNuisance: dropped.remaining,
  };
  return spawn(next);
};

const playing = (state: PuyoState): boolean => state.status === "PLAYING" && state.active !== null;

export const puyoReducer = (state: PuyoState, action: PuyoAction): PuyoState => {
  switch (action.type) {
    case "START": {
      const colorCount = action.colorCount ?? 4;
      const started: PuyoState = {
        ...createPuyoState(),
        status: "PLAYING",
        colorCount,
        seed: action.seed,
        randomState: action.seed >>> 0,
      };
      return spawn(started);
    }
    case "MOVE": {
      if (!playing(state) || !state.active) return state;
      const moved = { ...state.active, col: state.active.col + action.offset };
      return collides(state.board, moved) ? state : { ...state, active: moved };
    }
    case "ROTATE": {
      if (!playing(state) || !state.active) return state;
      const rotated = tryRotate(state.board, state.active, action.direction);
      return rotated ? { ...state, active: rotated } : state;
    }
    case "SOFT_DROP": {
      if (!playing(state) || !state.active) return state;
      const dropped = { ...state.active, row: state.active.row + 1 };
      if (collides(state.board, dropped)) return state;
      return { ...state, active: dropped, score: state.score + 1 };
    }
    case "HARD_DROP": {
      if (!playing(state) || !state.active) return state;
      const distance = dropDistance(state.board, state.active);
      const landed = { ...state.active, row: state.active.row + distance };
      return lockPair({ ...state, active: landed, score: state.score + distance * 2 });
    }
    case "TICK": {
      if (!playing(state) || !state.active) return state;
      const dropped = { ...state.active, row: state.active.row + 1 };
      return collides(state.board, dropped) ? lockPair(state) : { ...state, active: dropped };
    }
    case "TOGGLE_PAUSE":
      if (state.status === "PLAYING") return { ...state, status: "PAUSED" };
      if (state.status === "PAUSED") return { ...state, status: "PLAYING" };
      return state;
    case "PAUSE":
      return state.status === "PLAYING" ? { ...state, status: "PAUSED" } : state;
    case "ADD_GARBAGE":
      if (state.status === "GAME_OVER" || action.count <= 0) return state;
      return { ...state, pendingNuisance: state.pendingNuisance + Math.min(MAX_NUISANCE_PER_LOCK, action.count) };
    case "END":
      return createPuyoState();
  }
};

export const createDisplayBoard = (state: PuyoState): Array<Array<DisplayCell | null>> => {
  const display: Array<Array<DisplayCell | null>> = state.board.slice(PUYO_HIDDEN_ROWS).map((row) =>
    row.map((cell): DisplayCell | null => (cell ? { color: cell, kind: "PLACED" } : null)),
  );
  const paint = (pair: ActivePair, kind: DisplayKind) => {
    for (const cell of pairCells(pair)) {
      const visibleRow = cell.row - PUYO_HIDDEN_ROWS;
      if (visibleRow < 0 || visibleRow >= PUYO_VISIBLE_ROWS || cell.col < 0 || cell.col >= PUYO_COLS) continue;
      const target = display[visibleRow];
      if (target) target[cell.col] = { color: cell.color, kind };
    }
  };
  if (state.active) {
    const ghost = { ...state.active, row: state.active.row + dropDistance(state.board, state.active) };
    paint(ghost, "GHOST");
    paint(state.active, "ACTIVE");
  }
  return display;
};
