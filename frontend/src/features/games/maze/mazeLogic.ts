import { randomInt, type RandomSource } from "@/features/games/shared/random";

export const mazeDifficulties = { EASY: { label: "쉬움", size: 11 }, NORMAL: { label: "보통", size: 17 }, HARD: { label: "어려움", size: 23 } } as const;
export type MazeDifficulty = keyof typeof mazeDifficulties;
export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
export interface Point { row: number; col: number }
export interface Maze {
  size: number;
  walls: boolean[][];
  start: Point;
  exit: Point;
}
const deltas: Record<Direction, Point> = { UP: { row: -1, col: 0 }, DOWN: { row: 1, col: 0 }, LEFT: { row: 0, col: -1 }, RIGHT: { row: 0, col: 1 } };
const equal = (a: Point, b: Point) => a.row === b.row && a.col === b.col;

/** 반복 DFS로 아직 방문하지 않은 방까지 벽을 뚫는다. 모든 방은 하나의 길로 연결된다. */
export function createMaze(size: number, random: RandomSource): Maze {
  if (!Number.isInteger(size) || size < 5 || size > 51 || size % 2 === 0) throw new Error("미로 크기는 5~51 사이의 홀수여야 합니다.");
  const walls = Array.from({ length: size }, () => Array<boolean>(size).fill(true));
  const start = { row: 1, col: 1 };
  const stack: Point[] = [start];
  walls[1]![1] = false;
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    if (!current) break;
    const candidates = Object.values(deltas).map((delta) => ({ row: current.row + delta.row * 2, col: current.col + delta.col * 2 }))
      .filter((point) => point.row > 0 && point.row < size - 1 && point.col > 0 && point.col < size - 1 && walls[point.row]?.[point.col]);
    if (candidates.length === 0) { stack.pop(); continue; }
    const next = candidates[randomInt(candidates.length, random)];
    if (!next) continue;
    walls[(current.row + next.row) / 2]![(current.col + next.col) / 2] = false;
    walls[next.row]![next.col] = false;
    stack.push(next);
  }
  return { size, walls, start, exit: { row: size - 2, col: size - 2 } };
}

export function moveInMaze(maze: Maze, position: Point, direction: Direction): Point {
  const delta = deltas[direction];
  const next = { row: position.row + delta.row, col: position.col + delta.col };
  return maze.walls[next.row]?.[next.col] === false ? next : position;
}

/** BFS로 현재 위치부터 출구까지의 최단 경로를 찾는다. 입력 미로는 바꾸지 않는다. */
export function findMazePath(maze: Maze, from = maze.start): Point[] {
  if (maze.walls[from.row]?.[from.col] !== false) return [];
  const key = (point: Point) => point.row * maze.size + point.col;
  const queue = [from];
  const previous = new Map<number, Point | null>([[key(from), null]]);
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (!current) break;
    if (equal(current, maze.exit)) {
      const path: Point[] = [];
      let point: Point | null = current;
      while (point) { path.push(point); point = previous.get(key(point)) ?? null; }
      return path.reverse();
    }
    for (const direction of Object.keys(deltas) as Direction[]) {
      const next = moveInMaze(maze, current, direction);
      if (equal(current, next) || previous.has(key(next))) continue;
      previous.set(key(next), current);
      queue.push(next);
    }
  }
  return [];
}

export const isMazeExit = (maze: Maze, point: Point) => equal(maze.exit, point);
