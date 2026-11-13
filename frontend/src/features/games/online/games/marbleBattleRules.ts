import { z } from "zod";
import { marbleTiles } from "@/features/games/marble/marbleLogic";

export const marbleBattleSchema = z.object({
  players: z.array(z.object({ name: z.string().min(1).max(40), computer: z.boolean(), cash: z.number().int().min(0).max(1_000_000),
    position: z.number().int().min(0).max(19), skip: z.boolean(), bankrupt: z.boolean() })).min(2).max(4),
  properties: z.array(z.object({ owner: z.number().int().min(0).max(3).nullable(), level: z.number().int().min(0).max(3) })).length(marbleTiles.length),
  turn: z.number().int().min(0).max(3), turnsPlayed: z.number().int().min(0).max(80),
  phase: z.enum(["ROLL", "DECIDE", "END", "OVER"]), dice: z.tuple([z.number().int().min(1).max(6), z.number().int().min(1).max(6)]).nullable(),
  winners: z.array(z.number().int().min(0).max(3)).max(4), log: z.array(z.string().max(300)).max(7), deadline: z.number().int().nonnegative().nullable(),
}).refine((game) => game.turn < game.players.length && game.properties.every((property) => property.owner === null || property.owner < game.players.length)
  && game.winners.every((seat) => seat < game.players.length));
