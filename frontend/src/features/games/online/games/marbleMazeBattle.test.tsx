import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createMarbleGame } from "@/features/games/marble/marbleLogic";
import { createMaze } from "@/features/games/maze/mazeLogic";
import { createSeededRandom } from "@/features/games/shared/random";
import type { OnlineRoom } from "../onlineTypes";
import { MarbleBattle } from "./MarbleBattle";
import { marbleBattleSchema } from "./marbleBattleRules";
import { MazeBattle } from "./MazeBattle";
import { mazeBattleSchema } from "./mazeBattleRules";

const room = (gameType: string, game: unknown): OnlineRoom => ({
  roomId: "abcd2345", title: "대전 방", gameType, gameTypeLabel: gameType, seatCount: 2, maxParticipants: 10,
  hasPassword: false, membersOnly: false, status: "PLAYING", hostId: "p1", myParticipantId: "p1", seats: ["p1", "p2"],
  participants: [{ participantId: "p1", nickname: "가", member: false, seatIndex: 0 }, { participantId: "p2", nickname: "나", member: false, seatIndex: 1 }], game,
});

it("부루마블에서 서버 상태를 유지하며 자기 차례의 행동만 보낸다", () => {
  const send = vi.fn(() => true);
  const game = { ...createMarbleGame(1, 0), deadline: null };
  game.turn = 1; game.players[1]!.position = 2; game.phase = "DECIDE";
  const props = { room: room("MARBLE", game), mySeat: 1, connected: true, send };
  const view = render(<MarbleBattle {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /^땅 사기/ }));
  expect(send).toHaveBeenCalledWith({ type: "GAME_ACTION", action: "BUY" });
  expect(game.players[1]?.cash).toBe(150); // 서버가 응답하기 전에 클라이언트가 자산을 바꾸지 않는다.
  view.rerender(<MarbleBattle {...props} connected={false} />);
  expect(screen.queryByRole("button", { name: /^땅 사기/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "주사위 굴리기" })).toBeDisabled();
  view.rerender(<MarbleBattle {...props} mySeat={null} />);
  expect(screen.queryByRole("button", { name: /^땅 사기/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "주사위 굴리기" })).toBeDisabled();
});

it("미로에서는 이동 방향만 보내고 관전·연결 끊김·종료 상태에서는 입력을 막는다", () => {
  const maze = createMaze(11, createSeededRandom(0));
  const game = { walls: maze.walls.map((row) => row.map((wall) => wall ? "1" : "0").join("")), size: 11, start: maze.start, exit: maze.exit,
    positions: [maze.start, maze.start], moves: [0, 0], active: [true, true], winnerSeats: [], deadline: null, finished: false };
  const send = vi.fn(() => true);
  const props = { room: room("MAZE", game), mySeat: 0, connected: true, send };
  const view = render(<MazeBattle {...props} />);
  fireEvent.keyDown(screen.getByRole("region", { name: "미로 키보드 조작 영역" }), { key: "ArrowRight" });
  expect(send).toHaveBeenCalledWith({ type: "GAME_ACTION", action: "MOVE", text: "RIGHT" });
  expect(screen.queryByRole("button", { name: "길 안내 보기" })).not.toBeInTheDocument();
  view.rerender(<MazeBattle {...props} connected={false} />);
  fireEvent.keyDown(screen.getByRole("region", { name: "미로 키보드 조작 영역" }), { key: "ArrowDown" });
  expect(send).toHaveBeenCalledTimes(1);
  view.rerender(<MazeBattle {...props} mySeat={null} />);
  expect(screen.getByRole("button", { name: "오른쪽으로 이동" })).toBeDisabled();
  view.rerender(<MazeBattle {...props} room={room("MAZE", { ...game, finished: true, winnerSeats: [1] })} />);
  expect(screen.getByRole("status")).toHaveTextContent("나 승리!");
  expect(screen.getByRole("button", { name: "오른쪽으로 이동" })).toBeDisabled();
});

it("잘못된 서버 판 크기·소유권·자리 번호를 거부한다", () => {
  const base = { ...createMarbleGame(1, 0), deadline: null };
  expect(marbleBattleSchema.safeParse(base).success).toBe(true);
  expect(marbleBattleSchema.safeParse({ ...base, turn: 3 }).success).toBe(false);
  expect(marbleBattleSchema.safeParse({ ...base, properties: base.properties.map(() => ({ owner: 3, level: 0 })) }).success).toBe(false);
  expect(mazeBattleSchema.safeParse({ walls: ["0"], size: 11 }).success).toBe(false);
});
