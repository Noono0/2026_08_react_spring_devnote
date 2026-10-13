/**
 * onlineRoomReducer.ts — WebSocket으로 받은 메시지를 화면 상태로 바꾸는 순수 리듀서
 *
 * [서버가 정답, 화면은 그리기만]
 *   돌을 둘 때 화면이 먼저 판을 바꾸지 않는다. 서버가 규칙을 확인하고 보낸 ROOM_STATE를 받아야 바뀐다.
 *   그래서 두 사람의 화면이 서로 어긋나지 않고, 화면을 조작해 규칙을 어기는 것도 막힌다.
 *
 * 연결 상태(CONNECTING·OPEN·CLOSED)와 서버 메시지를 한 리듀서에서 다뤄, 상태가 바뀌는 길을 한곳에서 볼 수 있다.
 */
import { onlineServerMessageSchema, type OnlineChat, type OnlineRoom, type OnlineServerMessage } from "@/features/games/online/onlineTypes";

/** 화면에 남겨 둘 채팅 수(서버는 50개, 화면은 조금 더 여유 있게) */
export const CHAT_KEEP_COUNT = 100;

export type ConnectionStatus = "CONNECTING" | "OPEN" | "CLOSED";

export interface OnlineRoomClientState {
  connection: ConnectionStatus;
  room: OnlineRoom | null;
  chats: OnlineChat[];
  /** 마지막 오류. sequence는 같은 오류가 다시 와도 화면이 "새 알림"으로 알아보게 붙인 번호 */
  lastError: { code: string; message: string; sequence: number } | null;
  /** 비밀번호를 입력해야 들어갈 수 있는 상태 */
  passwordRequired: boolean;
  closedReason: string | null;
  /** 테트리스 대전에서 받은 방해 줄. sequence가 바뀌면 화면이 내 판에 줄을 넣는다 */
  incomingGarbage: { lines: number; holeCol: number; fromNickname: string; sequence: number } | null;
  /** 뿌요뿌요 대전에서 받은 방해 뿌요. sequence가 바뀌면 화면이 대기열에 넣는다 */
  incomingPuyoGarbage: { count: number; fromNickname: string; sequence: number } | null;
}

export type OnlineRoomAction =
  | { type: "CONNECTING" }
  | { type: "OPEN" }
  | { type: "CLOSED"; reason: string | null }
  | { type: "SERVER_MESSAGE"; message: OnlineServerMessage };

export const initialOnlineRoomState: OnlineRoomClientState = {
  connection: "CONNECTING",
  room: null,
  chats: [],
  lastError: null,
  passwordRequired: false,
  closedReason: null,
  incomingGarbage: null,
  incomingPuyoGarbage: null,
};

const PASSWORD_ERROR_CODES = new Set(["ONLINE_ROOM_PASSWORD_REQUIRED", "ONLINE_ROOM_PASSWORD_INVALID"]);

/** 받은 글자(JSON)를 검사해 메시지로 바꾼다. 모양이 틀리면 null */
export const parseServerMessage = (raw: unknown): OnlineServerMessage | null => {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // JSON이 아니면 서버가 보낸 메시지가 아니다(부르는 쪽이 경고를 남긴다)
  }
  const result = onlineServerMessageSchema.safeParse(parsed);
  return result.success ? result.data : null;
};

const applyServerMessage = (state: OnlineRoomClientState, message: OnlineServerMessage): OnlineRoomClientState => {
  switch (message.type) {
    case "ROOM_STATE":
      // 처음 들어온 순간(room이 null → 값)에는 들어오기 전 오류(비밀번호 틀림 등)를 지운다. 방 안에서 계속 보이면 헷갈린다
      return { ...state, room: message.room, passwordRequired: false, lastError: state.room === null ? null : state.lastError };
    case "CHAT": {
      // 같은 채팅이 두 번 오지 않도록 chatId로 거르고, 최근 것만 남긴다(불변성: 새 배열)
      const knownIds = new Set(state.chats.map((chat) => chat.chatId));
      const merged = [...state.chats, ...message.chats.filter((chat) => !knownIds.has(chat.chatId))];
      return { ...state, chats: merged.slice(-CHAT_KEEP_COUNT) };
    }
    case "ERROR":
      return {
        ...state,
        lastError: { ...message.error, sequence: (state.lastError?.sequence ?? 0) + 1 },
        passwordRequired: state.room === null && PASSWORD_ERROR_CODES.has(message.error.code) ? true : state.passwordRequired,
      };
    case "PONG":
      return state;
    case "TETRIS_GARBAGE":
      return { ...state, incomingGarbage: { ...message.garbage, sequence: (state.incomingGarbage?.sequence ?? 0) + 1 } };
    case "PUYO_GARBAGE":
      return { ...state, incomingPuyoGarbage: { count: message.garbage.lines, fromNickname: message.garbage.fromNickname, sequence: (state.incomingPuyoGarbage?.sequence ?? 0) + 1 } };
  }
};

export const onlineRoomReducer = (state: OnlineRoomClientState, action: OnlineRoomAction): OnlineRoomClientState => {
  switch (action.type) {
    case "CONNECTING":
      // 다시 연결하면 방 상태·대화는 서버가 처음부터 다시 보내 준다
      return { ...initialOnlineRoomState, lastError: state.lastError };
    case "OPEN":
      return { ...state, connection: "OPEN", closedReason: null };
    case "CLOSED":
      return { ...state, connection: "CLOSED", closedReason: action.reason };
    case "SERVER_MESSAGE":
      return applyServerMessage(state, action.message);
  }
};

/** 내 정보와 내 자리(관전자면 null) */
export const findMe = (room: OnlineRoom) => {
  const me = room.participants.find((participant) => participant.participantId === room.myParticipantId) ?? null;
  return { me, mySeat: me?.seatIndex ?? null, isHost: room.hostId === room.myParticipantId };
};
