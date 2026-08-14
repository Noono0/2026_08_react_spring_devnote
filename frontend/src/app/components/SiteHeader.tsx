import { Link } from "react-router-dom";
import { AuthenticationControls } from "@/features/auth/components/AuthenticationControls";
import { useAuthSessionQuery } from "@/features/auth/hooks/useAuthSession";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";

export const SiteHeader = () => {
  const sessionQuery = useAuthSessionQuery();
  const applicationTheme = useApplicationUiStore((state) => state.applicationTheme);
  const toggleApplicationTheme = useApplicationUiStore((state) => state.toggleApplicationTheme);

  return (
    <header className="site-header">
      <Link className="portfolio-brand" to="/"><span>DN</span><strong>DevNote</strong></Link>
      <nav aria-label="전체 메뉴">
        <Link to="/">홈</Link>
        <div className="site-menu-dropdown"><Link to="/react">React 연습</Link><div className="site-submenu"><Link to="/react">전체 로드맵</Link><Link to="/react/level/beginner">왕초보</Link><Link to="/react/level/basic">초급</Link><Link to="/react/level/intermediate">중급</Link><Link to="/react/level/advanced">고급</Link></div></div>
        <Link to="/history">나의 업무 History</Link>
        <div className="site-menu-dropdown"><Link to="/utilities">개발 유틸리티</Link><div className="site-submenu utility-site-submenu"><Link to="/utilities/api-workspace">API Workspace</Link><Link to="/utilities/regex">Regex Tester</Link><Link to="/utilities/formatter">Code Formatter</Link><Link to="/utilities/converter">Data Converter</Link><Link to="/utilities/json-csv">JSON ↔ CSV</Link><Link to="/utilities/diff">Code Diff</Link><Link to="/utilities/jwt">JWT Decoder</Link><Link to="/utilities/markdown">Markdown Editor</Link><Link to="/utilities/test-data">Test Data</Link><Link to="/utilities/snippets">Developer Snippet</Link><Link to="/utilities/cron">Cron Generator</Link><Link to="/utilities/tools">Quick Tools</Link><Link to="/utilities/polls">투표</Link></div></div>
        {sessionQuery.data?.administrator ? <div className="site-menu-dropdown"><Link to="/admin">관리자</Link><div className="site-submenu"><Link to="/admin/members">회원관리</Link><Link to="/admin/grades">등급관리</Link><Link to="/admin/permissions">권한관리</Link><Link to="/admin/analytics">방문통계</Link></div></div> : null}
      </nav>
      <div className="site-header-actions"><AuthenticationControls /><button type="button" className="ghost-button" onClick={toggleApplicationTheme} aria-label={applicationTheme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경"}>{applicationTheme === "dark" ? "☀" : "☾"}</button></div>
    </header>
  );
};
