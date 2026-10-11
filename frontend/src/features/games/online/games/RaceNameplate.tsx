// RaceNameplate.tsx — 2048 대전·지뢰 찾기 대전의 판 위 이름표(이름 · 기록 · 상태/순위)
import { raceBadgeText, type RaceStatus } from "@/features/games/online/games/raceBattleRules";

interface RaceNameplateProperties {
  nickname: string;
  isMe: boolean;
  status: RaceStatus;
  rank: number | null | undefined;
  winner: boolean;
  /** 게임마다 다른 기록 글자. 예) "1,024점 · 35번" */
  record: string;
}

export const RaceNameplate = ({ nickname, isMe, status, rank, winner, record }: RaceNameplateProperties) => (
  <div className={`tetris-nameplate race-nameplate status-${status.toLowerCase()}${winner ? " winner" : ""}`}>
    <strong>{nickname}{isMe ? " (나)" : ""}</strong>
    <span>{record} · {winner ? "🏆 " : ""}{raceBadgeText(status, rank)}</span>
  </div>
);
