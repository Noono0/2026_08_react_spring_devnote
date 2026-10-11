/**
 * playerNickname.ts — 비회원이 게임에서 쓰는 닉네임(온라인 대전 방과 랭킹 등록이 함께 쓴다)
 *
 * 서버 규칙(OnlineRoomService·GameRankingService)과 같다: 앞뒤 공백을 빼고 2~12자.
 * 저장 키는 온라인 대전에서 먼저 쓰던 이름 그대로 두어, 이미 저장된 닉네임을 이어서 쓴다.
 */
import { z } from "zod";

export const PLAYER_NICKNAME_KEY = "online.nickname";
export const playerNicknameSchema = z.string().trim().min(2).max(12);
