/**
 * VisitAnalyticsPage.tsx — 관리자: 방문 통계 (오늘·이번 달 방문자, 최근 14일·12개월 막대 그래프, 최근 방문 50건)
 * 그래프 라이브러리 없이 div 높이(%)로 막대를 그린다.
 */

import { useVisitAnalyticsQuery } from "@/features/admin/hooks/useAdminQueries";
import { FeatureHelpButton } from "@/features/help/FeatureHelpButton";

/**
 * 막대 높이 = 그 기간 조회 수 ÷ 가장 큰 조회 수 × 100%. 0이어도 보이도록 최소 4%로 그린다.
 * Math.max(..., 1): 모든 값이 0이면 0으로 나누지 않도록 최소값 1을 둔다. 막대 아래 숫자는 방문자 수다.
 */
const Chart = ({ values }: { values: Array<{ period: string; visitors: number; pageViews: number }> }) => {
  const maximum = Math.max(...values.map((value) => value.pageViews), 1);
  return <div className="visit-chart">{values.map((value) => <div className="visit-bar-item" key={value.period}><div className="visit-bar" style={{ height: `${Math.max(value.pageViews / maximum * 100, 4)}%` }} title={`${value.pageViews} 페이지뷰`} /><strong>{value.visitors}</strong><small>{value.period.slice(5)}</small></div>)}</div>;
};

export const VisitAnalyticsPage = () => {
  const query = useVisitAnalyticsQuery();
  if (query.isPending) return <div className="portfolio-state-panel">방문 통계를 불러오는 중입니다.</div>;
  if (query.isError) return <div className="portfolio-state-panel error-state">방문 통계를 불러오지 못했습니다.</div>;
  // 최근 방문 key: 같은 방문자가 같은 시각에 여러 번 기록될 수 있어 index까지 붙여 겹치지 않게 한다.
  return <section className="site-page"><div className="page-hero"><span className="page-kicker">Visitor Analytics</span><div className="page-title-with-guide"><h1>방문 통계</h1><FeatureHelpButton topic="analytics" /></div><p>세션 기반 익명 방문자를 집계하며 로그인 회원은 회원 ID와 연결됩니다.</p></div><div className="analytics-summary"><article><strong>{query.data.todayVisitors}</strong><span>오늘 방문자</span></article><article><strong>{query.data.monthVisitors}</strong><span>이번 달 방문자</span></article></div><article className="analytics-panel"><h2>최근 14일</h2><Chart values={query.data.daily} /></article><article className="analytics-panel"><h2>최근 12개월</h2><Chart values={query.data.monthly} /></article><article className="analytics-panel"><h2>최근 이용 이력</h2><div className="admin-table-wrap"><table><thead><tr><th>이용자</th><th>경로</th><th>방문 시각</th></tr></thead><tbody>{query.data.recentVisits.map((visit, index) => <tr key={`${visit.visitorKey}-${visit.visitedAt}-${index}`}><td><strong>{visit.memberName ?? "비회원"}</strong><small>{visit.loginId ?? `방문자 ${visit.visitorKey}`}</small></td><td><code>{visit.visitedPath}</code></td><td>{visit.visitedAt.slice(0, 16).replace("T", " ")}</td></tr>)}</tbody></table>{query.data.recentVisits.length === 0 ? <p>아직 방문 이력이 없습니다.</p> : null}</div></article></section>;
};
