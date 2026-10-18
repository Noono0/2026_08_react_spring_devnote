// rankingTypes.ts — 게임 랭킹 API의 요청·응답 모양(서버 ranking/dto와 1:1)

export type SoloGameCode = "GAME_2048" | "TETRIS" | "PUYO" | "MINESWEEPER" | "MEMORY" | "SUDOKU" | "APPLE" | "SUIKA";

/** 조회 기간. 한국 날짜 "yyyy-MM-dd"이고 null이면 그쪽 끝은 제한하지 않는다(둘 다 null = 전체) */
export interface RankingPeriod {
  from: string | null;
  to: string | null;
}

/** 온라인 대전 랭킹 한 줄. member=false면 비회원(닉네임 기준), winRate는 0~1 */
export interface OnlineRankingEntry {
  rank: number;
  playerName: string;
  member: boolean;
  wins: number;
  plays: number;
  winRate: number;
}

/** 혼자 하는 게임 랭킹 한 줄(사람마다 기간 안의 최고 기록). 그 게임에서 쓰지 않는 값은 null */
export interface SoloRankingEntry {
  rank: number;
  playerName: string;
  member: boolean;
  score: number | null;
  elapsedSeconds: number | null;
  moves: number | null;
  playedAt: string;
}

/** 기록 등록 요청. 게임마다 필요한 값만 채운다. nickname은 비회원만 */
export interface SoloGameRecordRequest {
  gameCode: SoloGameCode;
  difficulty?: string;
  nickname?: string;
  score?: number;
  elapsedSeconds?: number;
  moves?: number;
}

export interface SoloGameRecordSaved {
  soloGameRecordId: number;
  playerName: string;
  member: boolean;
}
