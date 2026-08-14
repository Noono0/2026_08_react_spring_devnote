import { useVisitAnalyticsQuery } from "@/features/admin/hooks/useAdminQueries";

const Chart = ({ values }: { values: Array<{ period: string; visitors: number; pageViews: number }> }) => {
  const maximum = Math.max(...values.map((value) => value.pageViews), 1);
  return <div className="visit-chart">{values.map((value) => <div className="visit-bar-item" key={value.period}><div className="visit-bar" style={{ height: `${Math.max(value.pageViews / maximum * 100, 4)}%` }} title={`${value.pageViews} 페이지뷰`} /><strong>{value.visitors}</strong><small>{value.period.slice(5)}</small></div>)}</div>;
};

export const VisitAnalyticsPage = () => {
  const query = useVisitAnalyticsQuery();
  if (query.isPending) return <div className="portfolio-state-panel">방문 통계를 불러오는 중입니다.</div>;
  if (query.isError) return <div className="portfolio-state-panel error-state">방문 통계를 불러오지 못했습니다.</div>;
  return <section className="site-page"><div className="page-hero"><span className="page-kicker">Visitor Analytics</span><h1>방문 통계</h1><p>세션 기반 익명 방문자를 집계하며 로그인 회원은 회원 ID와 연결됩니다.</p></div><div className="analytics-summary"><article><strong>{query.data.todayVisitors}</strong><span>오늘 방문자</span></article><article><strong>{query.data.monthVisitors}</strong><span>이번 달 방문자</span></article></div><article className="analytics-panel"><h2>최근 14일</h2><Chart values={query.data.daily} /></article><article className="analytics-panel"><h2>최근 12개월</h2><Chart values={query.data.monthly} /></article><article className="analytics-panel"><h2>최근 이용 이력</h2><div className="admin-table-wrap"><table><thead><tr><th>이용자</th><th>경로</th><th>방문 시각</th></tr></thead><tbody>{query.data.recentVisits.map((visit, index) => <tr key={`${visit.visitorKey}-${visit.visitedAt}-${index}`}><td><strong>{visit.memberName ?? "비회원"}</strong><small>{visit.loginId ?? `방문자 ${visit.visitorKey}`}</small></td><td><code>{visit.visitedPath}</code></td><td>{visit.visitedAt.slice(0, 16).replace("T", " ")}</td></tr>)}</tbody></table>{query.data.recentVisits.length === 0 ? <p>아직 방문 이력이 없습니다.</p> : null}</div></article></section>;
};
