/**
 * onlineTypes.ts — 온라인 대전에서 서버와 주고받는 데이터 모양
 *
 * ★ WebSocket으로 받은 메시지는 "믿을 수 없는 입력"이다.
 *   REST처럼 공통 HTTP 클라이언트를 거치지 않고 문자열(JSON)로 바로 들어오므로,
 *   zod 스키마로 모양을 확인한 뒤에만 화면 상태에 넣는다(onlineRoomReducer).
 *
 * 서버 쪽 짝: backend/src/main/java/com/example/devnote/online/dto/*
 */
import { z } from "zod";

// ── 대기실(REST) ────────────────────────────────────────────

export interface OnlineGameTypeInfo {
  code: string;
  label: string;
  minSeats: number;
  maxSeats: number;
  available: boolean;
}

export interface OnlineRoomSummary {
  roomId: string;
  title: string;
  gameType: string;
  gameTypeLabel: string;
  seatCount: number;
  playerCount: number;
  participantCount: number;
  maxParticipants: number;
  status: "WAITING" | "PLAYING";
  hasPassword: boolean;
  membersOnly: boolean;
  hostNickname: string | null;
}

export interface OnlineRoomCreateRequest {
  title: string;
  gameType: string;
  seatCount: number;
  password: string;
  membersOnly: boolean;
}

export interface OnlineRoomCreated {
  roomId: string;
  hostToken: string;
}

// ── 방 안(WebSocket, 서버 → 화면) ─────────────────────────────

const positionSchema = z.object({ row: z.number().int(), col: z.number().int() });

const omokSchema = z.object({
  board: z.array(z.array(z.number().int().min(0).max(2))),
  turnSeat: z.number().int(),
  winnerSeat: z.number().int().nullish(),
  draw: z.boolean(),
  lastMove: positionSchema.nullish(),
  winLine: z.array(positionSchema),
});

/** 테트리스 대전 판 요약: 보이는 20줄 × 10칸 = 200글자("." 빈칸, I·O·T·S·Z·J·L 블록, G 방해 줄) */
export const TETRIS_BOARD_TEXT_LENGTH = 200;
const tetrisPlayerSchema = z.object({
  seatIndex: z.number().int(),
  nickname: z.string(),
  alive: z.boolean(),
  score: z.number().int(),
  lines: z.number().int(),
  board: z.string().regex(/^[.IOTSZJLG]{200}$/),
  rank: z.number().int(),
});

const tetrisSchema = z.object({
  seed: z.number().int(),
  winnerSeat: z.number().int().nullish(),
  players: z.array(tetrisPlayerSchema),
});

const participantSchema = z.object({
  participantId: z.string(),
  nickname: z.string(),
  member: z.boolean(),
  seatIndex: z.number().int().nullish(),
});

export const onlineRoomSchema = z.object({
  roomId: z.string(),
  title: z.string(),
  gameType: z.string(),
  gameTypeLabel: z.string(),
  seatCount: z.number().int(),
  maxParticipants: z.number().int(),
  hasPassword: z.boolean(),
  membersOnly: z.boolean(),
  status: z.enum(["WAITING", "PLAYING"]),
  hostId: z.string().nullish(),
  myParticipantId: z.string(),
  seats: z.array(z.string().nullable()),
  participants: z.array(participantSchema),
  omok: omokSchema.nullish(),
  tetris: tetrisSchema.nullish(),
  /** 공통 틀 게임(숫자 야구 등)의 상태. 모양은 gameType마다 달라 각 게임 화면이 자기 스키마로 다시 확인한다 */
  game: z.unknown().nullish(),
  lastResult: z.string().nullish(),
});

const chatSchema = z.object({
  chatId: z.number().int(),
  nickname: z.string().nullish(),
  text: z.string(),
  sentAt: z.number(),
  system: z.boolean(),
  spectator: z.boolean(),
});

/** type 칸으로 모양이 갈리는 메시지 → discriminatedUnion */
export const onlineServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ROOM_STATE"), room: onlineRoomSchema }),
  z.object({ type: z.literal("CHAT"), chats: z.array(chatSchema) }),
  z.object({ type: z.literal("ERROR"), error: z.object({ code: z.string(), message: z.string() }) }),
  z.object({ type: z.literal("PONG") }),
  z.object({ type: z.literal("TETRIS_GARBAGE"), garbage: z.object({ lines: z.number().int().min(1).max(20), holeCol: z.number().int().min(0).max(9), fromNickname: z.string() }) }),
]);

export type OnlineRoom = z.infer<typeof onlineRoomSchema>;
export type OnlineParticipant = z.infer<typeof participantSchema>;
export type OnlineChat = z.infer<typeof chatSchema>;
export type OmokState = z.infer<typeof omokSchema>;
export type TetrisBattleState = z.infer<typeof tetrisSchema>;
export type TetrisBattlePlayer = z.infer<typeof tetrisPlayerSchema>;
export type OnlineServerMessage = z.infer<typeof onlineServerMessageSchema>;

// ── 방 안(WebSocket, 화면 → 서버) ─────────────────────────────

export interface OnlineRoomSettingsInput {
  title: string;
  gameType: string;
  seatCount: number;
  newPassword: string;
  removePassword: boolean;
  membersOnly: boolean;
}

/** 화면이 보낼 수 있는 메시지. 서버 OnlineClientMessage의 type과 같다 */
export type OnlineClientMessage =
  | { type: "JOIN"; roomId: string; nickname?: string; password?: string; hostToken?: string }
  | { type: "SIT"; seatIndex: number }
  | { type: "STAND" }
  | { type: "UPDATE_ROOM"; settings: OnlineRoomSettingsInput }
  | { type: "START" }
  | { type: "OMOK_PLACE"; row: number; col: number }
  | { type: "RESIGN" }
  | { type: "CHAT"; text: string }
  | { type: "TETRIS_BOARD"; board: string; score: number; lines: number }
  | { type: "TETRIS_ATTACK"; cleared: number }
  | { type: "TETRIS_TOPPED_OUT" }
  | { type: "GAME_ACTION"; action: string; text?: string; number?: number; numbers?: number[] }
  | { type: "PING" };
