// onlineRoomHelpers.ts — 방 화면 여러 곳에서 쓰는 작은 계산 함수(컴포넌트 파일에는 컴포넌트만 두기 위해 따로 뺐다)
import type { OnlineRoomSettingsInput } from "@/features/games/online/onlineTypes";
import { HIDDEN_ROWS, type TetrisBoard } from "@/features/games/tetris/tetrisLogic";

/** 테트리스 대전: 내 판(숨은 줄 제외) → 서버에 보낼 200글자 요약("." 빈칸, 블록 글자, G 방해 줄) */
export const toBoardText = (board: TetrisBoard): string =>
  board.slice(HIDDEN_ROWS).map((row) => row.map((cell) => cell ?? ".").join("")).join("");

export type PasswordMode = "KEEP" | "CHANGE" | "REMOVE";

export interface OnlineRoomFormValues {
  title: string;
  gameType: string;
  seatCount: number;
  password: string;
  passwordMode: PasswordMode;
  membersOnly: boolean;
}

/** 오목은 0번 흑·1번 백, 다른 게임은 "N번 자리" */
export const seatLabel = (gameType: string, seatIndex: number): string =>
  gameType === "OMOK" ? (seatIndex === 0 ? "● 흑" : "○ 백") : `${seatIndex + 1}번 자리`;

/**
 * 수정 폼 값 → 서버 UPDATE_ROOM 설정
 *   비밀번호가 없던 방: 칸에 쓰면 새로 걸고, 비우면 그대로(없음)
 *   비밀번호가 있던 방: 그대로(KEEP) / 바꾸기(CHANGE, 새 비밀번호) / 해제(REMOVE)
 */
export const toRoomSettings = (values: OnlineRoomFormValues, hasPassword: boolean): OnlineRoomSettingsInput => ({
  title: values.title.trim(),
  gameType: values.gameType,
  seatCount: values.seatCount,
  newPassword: !hasPassword || values.passwordMode === "CHANGE" ? values.password : "",
  removePassword: hasPassword && values.passwordMode === "REMOVE",
  membersOnly: values.membersOnly,
});
