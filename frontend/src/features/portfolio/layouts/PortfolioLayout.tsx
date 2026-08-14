import { Link, Outlet, useLocation } from "react-router-dom";
import { ApplicationSidebar } from "@/app/components/ApplicationSidebar";
import { useApplicationUiStore } from "@/app/state/applicationUiStore";

const getPageTitle = (pathname: string): string => {
  if (pathname.startsWith("/history")) return "나의 업무 History";
  if (pathname.startsWith("/utilities")) return "각종 유틸리티 게시판";
  if (pathname.startsWith("/admin")) return "관리자";
  return "홈";
};

export const PortfolioLayout = () => {
  const location = useLocation();
  const isUtilityPage = location.pathname.startsWith("/utilities");
  const isSidebarCollapsed = useApplicationUiStore((state) => state.isSidebarCollapsed);
  const openMobileSidebar = useApplicationUiStore((state) => state.openMobileSidebar);

  return (
    <div className={`portfolio-shell application-shell${isSidebarCollapsed ? " application-shell-sidebar-collapsed" : ""}`}>
      <ApplicationSidebar />
      <div className="application-content-shell">
        <header className="portfolio-mobile-top-bar">
          <button className="top-bar-icon-button" type="button" onClick={openMobileSidebar} aria-label="사이드바 메뉴 열기">☰</button>
          <Link to="/"><span>DN</span><strong>{getPageTitle(location.pathname)}</strong></Link>
        </header>
        <main className={`portfolio-main${isUtilityPage ? " portfolio-main-wide" : ""}`}><Outlet /></main>
        <footer className="portfolio-footer"><p>React와 Spring Boot로 직접 관리하는 포트폴리오입니다.</p></footer>
      </div>
    </div>
  );
};
