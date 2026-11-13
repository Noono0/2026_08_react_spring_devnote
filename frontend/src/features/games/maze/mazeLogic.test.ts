import { expect, it } from "vitest";
import { createSeededRandom } from "@/features/games/shared/random";
import { createMaze, findMazePath, isMazeExit, moveInMaze, type Direction } from "./mazeLogic";

it("세 난이도의 여러 시드에서 경계가 닫혀 있고 출구까지 이동할 수 있다", () => {
  for (const size of [11, 17, 23]) for (let seed = 0; seed < 25; seed += 1) {
    const maze = createMaze(size, createSeededRandom(seed));
    const path = findMazePath(maze);
    expect(path[0]).toEqual(maze.start);
    expect(path[path.length - 1]).toEqual(maze.exit);
    let position = maze.start;
    for (const next of path.slice(1)) {
      const direction: Direction = next.row < position.row ? "UP" : next.row > position.row ? "DOWN" : next.col < position.col ? "LEFT" : "RIGHT";
      position = moveInMaze(maze, position, direction);
      expect(position).toEqual(next);
    }
    expect(isMazeExit(maze, position)).toBe(true);
    expect(maze.walls[0]?.every(Boolean)).toBe(true);
    expect(maze.walls[size - 1]?.every(Boolean)).toBe(true);
    expect(maze.walls.every((row) => row[0] && row[size - 1])).toBe(true);
  }
});

it("같은 시드는 같은 미로이며 이동·길 찾기는 원본을 바꾸지 않는다", () => {
  const maze = createMaze(11, createSeededRandom(42));
  expect(createMaze(11, createSeededRandom(42))).toEqual(maze);
  const original = structuredClone(maze);
  expect(moveInMaze(maze, maze.start, "UP")).toBe(maze.start);
  expect(moveInMaze(maze, maze.start, "LEFT")).toBe(maze.start);
  expect(findMazePath(maze, { row: 0, col: 0 })).toEqual([]);
  findMazePath(maze);
  expect(maze).toEqual(original);
});

it("잘못된 크기를 거부한다", () => {
  for (const size of [0, 4, 12, 53, 11.5]) expect(() => createMaze(size, createSeededRandom(0))).toThrow();
});
