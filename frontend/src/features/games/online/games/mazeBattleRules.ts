import { z } from "zod";

const point = z.object({ row: z.number().int().min(0).max(22), col: z.number().int().min(0).max(22) });
export const mazeBattleSchema = z.object({
  walls: z.array(z.string().regex(/^[01]+$/)).min(11).max(23), size: z.union([z.literal(11), z.literal(17), z.literal(23)]),
  start: point, exit: point, positions: z.array(point).min(2).max(4), moves: z.array(z.number().int().min(0).max(1_000_000)).min(2).max(4),
  active: z.array(z.boolean()).min(2).max(4), winnerSeats: z.array(z.number().int().min(0).max(3)).max(1),
  deadline: z.number().int().nonnegative().nullable(), finished: z.boolean(),
}).refine((game) => game.walls.length === game.size && game.walls.every((row) => row.length === game.size)
  && game.active.length === game.positions.length && game.moves.length === game.positions.length
  && [game.start, game.exit, ...game.positions].every((position) => game.walls[position.row]?.[position.col] === "0")
  && game.winnerSeats.every((seat) => seat < game.positions.length));
