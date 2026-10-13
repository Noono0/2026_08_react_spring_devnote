/**
 * RankingTables.tsx — 랭킹 표 두 가지(온라인 대전 / 혼자 하는 게임)
 *
 * 두 표는 부르는 API와 보여 줄 칸이 달라 컴포넌트를 나눴다. 각자 useQuery로 서버 상태를 가져오고
 * 불러오는 중·오류·빈 결과·목록 네 가지 상태를 그린다.
 * 조건(종목·난이도·기간)이 queryKey에 들어 있어, 조건이 바뀌면 TanStack Query가 알아서 새로 불러온다.
 */
import { useQuery } from "@tanstack/react-query";
import { formatSeconds } from "@/features/games/memory/memoryLogic";
import { getOnlineRanking, getSoloRanking } from "../rankingApi";
import { rankingErrorMessage } from "../rankingErrorMessage";
import { rankingQueryKeys } from "../rankingQueryKeys";
import type { OnlineRankingGame, SoloRankingGame, SoloRankingMetric } from "../rankingGames";
import type { RankingPeriod, SoloRankingEntry } from "../rankingTypes";

const PlayerName = ({ name, member }: { name: string; member: boolean }) => (
  <>
    {name}
    {member ? null : <span className="ranking-guest-badge">비회원</span>}
  </>
);

const StatePanel = ({ isPending, error, isEmpty }: { isPending: boolean; error: unknown; isEmpty: boolean }) => {
  if (isPending) return <p className="portfolio-state-panel">랭킹을 불러오는 중입니다.</p>;
  if (error) return <p className="portfolio-state-panel" role="alert">랭킹을 불러오지 못했습니다. {rankingErrorMessage(error)}</p>;
  if (isEmpty) return <p className="portfolio-state-panel">이 기간에는 기록이 없습니다. 첫 기록의 주인공이 되어 보세요.</p>;
  return null;
};

export const OnlineRankingTable = ({ game, period }: { game: OnlineRankingGame; period: RankingPeriod }) => {
  const rankingQuery = useQuery({
    queryKey: rankingQueryKeys.online(game.code, period),
    queryFn: () => getOnlineRanking(game.code, period),
  });
  const entries = rankingQuery.data ?? [];
  if (rankingQuery.isPending || rankingQuery.error || entries.length === 0) {
    return <StatePanel isPending={rankingQuery.isPending} error={rankingQuery.error} isEmpty={entries.length === 0} />;
  }
  return (
    <div className="admin-table-wrap ranking-table-wrap">
      <table>
        <caption className="visually-hidden">{game.label} 랭킹 — 승수가 많은 순, 같으면 승률이 높은 순</caption>
        <thead>
          <tr><th scope="col">순위</th><th scope="col">이름</th><th scope="col">승</th><th scope="col">판</th><th scope="col">승률</th></tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            // 같은 이름의 회원·비회원이 함께 있을 수 있어 key에 회원 여부를 섞는다
            <tr key={`${entry.member ? "member" : "guest"}:${entry.playerName}`}>
              <td className="ranking-rank">{entry.rank}</td>
              <td><PlayerName name={entry.playerName} member={entry.member} /></td>
              <td>{entry.wins}</td>
              <td>{entry.plays}</td>
              <td>{Math.round(entry.winRate * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const metricColumnLabels: Record<SoloRankingMetric, string> = { SCORE: "점수", TIME: "시간", MOVES_THEN_TIME: "시도 · 시간" };

const formatSoloRecord = (metric: SoloRankingMetric, entry: SoloRankingEntry): string => {
  if (metric === "SCORE") return `${(entry.score ?? 0).toLocaleString("ko-KR")}점`;
  const time = formatSeconds(entry.elapsedSeconds ?? 0);
  return metric === "TIME" ? time : `${entry.moves ?? 0}번 · ${time}`;
};

export const SoloRankingTable = ({ game, difficulty, period }: { game: SoloRankingGame; difficulty: string; period: RankingPeriod }) => {
  const rankingQuery = useQuery({
    queryKey: rankingQueryKeys.solo(game.code, difficulty, period),
    queryFn: () => getSoloRanking(game.code, difficulty, period),
  });
  const entries = rankingQuery.data ?? [];
  if (rankingQuery.isPending || rankingQuery.error || entries.length === 0) {
    return <StatePanel isPending={rankingQuery.isPending} error={rankingQuery.error} isEmpty={entries.length === 0} />;
  }
  return (
    <div className="admin-table-wrap ranking-table-wrap">
      <table>
        <caption className="visually-hidden">{game.label} 랭킹 — 사람마다 가장 좋은 기록 하나</caption>
        <thead>
          <tr><th scope="col">순위</th><th scope="col">이름</th><th scope="col">{metricColumnLabels[game.metric]}</th><th scope="col">기록한 날</th></tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.member ? "member" : "guest"}:${entry.playerName}`}>
              <td className="ranking-rank">{entry.rank}</td>
              <td><PlayerName name={entry.playerName} member={entry.member} /></td>
              <td>{formatSoloRecord(game.metric, entry)}</td>
              <td>{new Date(entry.playedAt).toLocaleDateString("ko-KR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
